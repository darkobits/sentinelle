"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = SentinelleFactory;

var _fs = _interopRequireDefault(require("fs"));

var _path = _interopRequireDefault(require("path"));

var _chokidar = _interopRequireDefault(require("chokidar"));

var _ow = _interopRequireDefault(require("ow"));

var _constants = require("../etc/constants");

var _log = _interopRequireDefault(require("./log"));

var _processDescriptor = _interopRequireDefault(require("./process-descriptor"));

var _utils = require("./utils");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function SentinelleFactory(options) {
  var _options$watch, _options$processShutd, _options$processShutd2, _options$stdio;

  const sentinelle = {};
  (0, _ow.default)(options.bin, 'bin', _ow.default.any(_ow.default.string, _ow.default.undefined));
  const _bin = options.bin;

  _log.default.silly(_log.default.prefix('bin'), _bin);

  (0, _ow.default)(options.entry, 'entry', _ow.default.string);
  const _entry = options.entry;

  _log.default.silly(_log.default.prefix('entry'), _entry);

  (0, _ow.default)(options.entryArgs, 'entryArgs', _ow.default.any(_ow.default.undefined, _ow.default.array.ofType(_ow.default.string)));

  const _entryArgs = (0, _utils.ensureArray)(options.entryArgs);

  _log.default.silly(_log.default.prefix('entryArgs'), _entryArgs);

  (0, _ow.default)(options.watch, 'watch', _ow.default.any(_ow.default.array.ofType(_ow.default.string), _ow.default.undefined));
  const _watches = [_path.default.resolve(_path.default.dirname(_entry)), ...((_options$watch = options.watch) !== null && _options$watch !== void 0 ? _options$watch : [])];

  _log.default.silly(_log.default.prefix('watches'), _watches);

  (0, _ow.default)(options.processShutdownGracePeriod, 'processShutdownGracePeriod', _ow.default.any(_ow.default.string, _ow.default.number, _ow.default.undefined));

  const _processShutdownGracePeriod = (0, _utils.parseTime)((_options$processShutd = options.processShutdownGracePeriod) !== null && _options$processShutd !== void 0 ? _options$processShutd : _constants.DEFAULT_SHUTDOWN_GRACE_PERIOD);

  _log.default.silly(_log.default.prefix('gracePeriod'), `${_processShutdownGracePeriod}ms`);

  (0, _ow.default)(options.processShutdownSignal, 'processShutdownSignal', _ow.default.any(_ow.default.string, _ow.default.undefined));

  const _processShutdownSignal = (_options$processShutd2 = options.processShutdownSignal) !== null && _options$processShutd2 !== void 0 ? _options$processShutd2 : _constants.DEFAULT_KILL_SIGNAL;

  _log.default.silly(_log.default.prefix('signal'), _processShutdownSignal);

  (0, _ow.default)(options.stdio, 'stdio', _ow.default.any(_ow.default.undefined, _ow.default.string, _ow.default.array.ofType(_ow.default.string)));

  const _stdio = (_options$stdio = options.stdio) !== null && _options$stdio !== void 0 ? _options$stdio : ['inherit', 'inherit', 'pipe'];

  _log.default.silly(_log.default.prefix('stdio'), _stdio);

  let _watcher;

  let _curProcess;

  const _initWatchers = () => {
    if (_watcher) {
      return;
    }

    const filteredWatches = _watches.reduce((finalWatches, curWatch) => {
      if (curWatch === '/') {
        _log.default.warn('Refusing to recursively watch "/"; watching entry file instead.');

        return [_entry, ...finalWatches];
      }

      return [...finalWatches, curWatch];
    }, []);

    filteredWatches.forEach(watch => {
      const isDir = _fs.default.statSync(watch).isDirectory();

      _log.default.info(_log.default.chalk.bold(`Watching ${isDir ? 'directory' : 'file'}`), _log.default.chalk.green(`${watch}`));
    });
    _watcher = _chokidar.default.watch(filteredWatches);

    _watcher.on('change', () => {
      if (!_curProcess) {
        _log.default.silly(_log.default.prefix('change'), 'No process running; starting process.');

        if (typeof sentinelle.start === 'function') {
          void sentinelle.start();
        }

        return;
      }

      if (_curProcess.getState() === 'STOPPING') {
        _log.default.silly(_log.default.prefix('change'), 'Process is still shutting-down; bailing.');

        return;
      }

      if (typeof sentinelle.restart === 'function') {
        void sentinelle.restart();
      }

      return;
    });

    _watcher.on('error', err => {
      if (err !== null && err !== void 0 && err.stack) {
        _log.default.error('Watcher error:', err.message);

        _log.default.verbose(err.stack.split('\n').slice(1).join('\n'));
      }
    });
  };

  const _stopProcess = async (signal = _processShutdownSignal) => {
    if (!_curProcess) {
      _log.default.warn('No process running.');

      return;
    }

    if (_curProcess.isClosed()) {
      _log.default.verbose('Process is already stopped; nothing to do.');

      return;
    }

    if (signal === 'SIGKILL') {
      _log.default.info(_log.default.chalk.bold('Forcefully stopping process...'));
    } else {
      _log.default.info(_log.default.chalk.bold('Stopping process...'));
    }

    _log.default.silly(`Sending signal ${_log.default.chalk.yellow.bold(signal)} to process.`);

    await _curProcess.kill(signal);
  };

  sentinelle.start = async () => {
    _initWatchers();

    if (_curProcess && !_curProcess.isClosed()) {
      _log.default.warn(_log.default.prefix('startProcess'), 'Waiting for process state to become "STOPPED".');

      await _curProcess.awaitClosed();
    }

    try {
      const [bin, ...binArgs] = _bin ? _bin.split(' ') : ['', ''];

      const [entry, ...entryArgs] = _entry.split(' ');

      const finalBin = bin ? (0, _utils.ensureBin)(bin) : (0, _utils.ensureFile)(entry);
      const finalArgs = bin ? [...binArgs, entry, ...entryArgs] : entryArgs;
      const commandAsString = `${bin || entry} ${finalArgs.join(' ')}`;

      _log.default.info(_log.default.chalk.bold('Starting'), _log.default.chalk.green(commandAsString));

      _curProcess = (0, _processDescriptor.default)({
        bin: finalBin,
        args: finalArgs,
        stdio: _stdio,
        shutdownGracePeriod: _processShutdownGracePeriod
      });
    } catch (err) {
      _log.default.error(err.message);

      _log.default.verbose(err.stack.split('\n').slice(1).join('\n'));
    }
  };

  sentinelle.restart = async (signal = _processShutdownSignal) => {
    if (!_curProcess) {
      return;
    }

    if (!_curProcess.isClosed()) {
      await _stopProcess(signal);
    }

    if (typeof sentinelle.start === 'function') {
      await sentinelle.start();
    }
  };

  sentinelle.stop = async (signal = _processShutdownSignal) => {
    if (!_curProcess) {
      return;
    }

    _log.default.verbose('Shutting down.');

    if (_watcher) {
      await _watcher.close();
      _watcher = undefined;

      _log.default.silly('My watch has ended.');
    }

    _log.default.silly(`Stopping process with signal ${_log.default.chalk.bold(signal)}.`);

    await _stopProcess(signal);
  };

  return sentinelle;
}

module.exports = exports.default;
//# sourceMappingURL=sentinelle.js.map