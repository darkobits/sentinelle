"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = ProcessDescriptorFactory;

var _fs = _interopRequireDefault(require("fs"));

var _os = _interopRequireDefault(require("os"));

var _execa = _interopRequireDefault(require("execa"));

var _pWaitFor = _interopRequireDefault(require("p-wait-for"));

var _log = _interopRequireDefault(require("./log"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function ProcessDescriptorFactory({
  bin,
  args,
  stdio,
  shutdownGracePeriod
}) {
  const processDescriptor = {};

  let _process;

  let _state;

  let _debuggerState = 'DISABLED';

  let _killReason;

  const _shutdownGracePeriod = shutdownGracePeriod || 4000;

  const _setState = newState => {
    if (_state !== newState) {
      _state = newState;

      _log.default.silly(`Set process state to ${_log.default.chalk.bold(newState)}.`);
    }
  };

  const _handleMessage = message => {
    _log.default.silly('process', message);
  };

  const _handleError = err => {
    if (err.exitCode === 2 && err.failed) {
      const firstLine = _fs.default.readFileSync(err.command, {
        encoding: 'utf8'
      }).split(_os.default.EOL)[0];

      if (!firstLine.startsWith('#!')) {
        _log.default.error('hint', _log.default.chalk.bold('Did you remember to set a shebang in your entrypoint?'));

        return;
      }
    }

    const ignoreMessages = ['Command failed', 'Command was killed with', 'Cannot destructure property `error`'];

    if (ignoreMessages.some(m => String(err.message).includes(m))) {
      return;
    }

    if (err !== null && err !== void 0 && err.stack) {
      _log.default.error(`Child process error: ${err.message}`);

      _log.default.verbose(err.stack.split('\n').slice(1).join('\n'));
    }

    if (err.code === 'EACCES') {
      _log.default.error('hint', _log.default.chalk.bold('Did you remember to set the executable flag on your entrypoint?'));
    }
  };

  const _handleStderrData = chunk => {
    const data = Buffer.from(chunk).toString('utf8');

    if (data.includes('Debugger listening on')) {
      _debuggerState = 'LISTENING';

      _log.default.verbose(`Set debugger state to ${_log.default.chalk.bold('LISTENING')}.`);
    }

    if (data.includes('Debugger attached')) {
      _debuggerState = 'ATTACHED';

      _log.default.verbose(`Set debugger state to ${_log.default.chalk.bold('ATTACHED')}.`);
    }

    if (/waiting for the debugger to disconnect/gi.test(data)) {
      _debuggerState = 'HANGING';
      _killReason = 'HANGING_DEBUGGER';

      if (typeof processDescriptor.kill === 'function') {
        void processDescriptor.kill('SIGKILL');
      }
    }
  };

  const _handleClose = (code, signal) => {
    if (_killReason === 'GRACE_PERIOD_EXPIRED') {
      _log.default.error(_log.default.chalk.red.bold('Process failed to shut-down in time and was killed.'));

      _setState('KILLED');

      return;
    }

    if (signal === 'SIGKILL') {
      _log.default.error(_log.default.chalk.red.bold('Process was killed.'));

      _setState('KILLED');

      return;
    }

    if (_killReason === 'PAUSED_DEBUGGER') {
      _log.default.info(_log.default.chalk.red.dim.bold('Detected paused debugger; process was killed.'));

      _setState('KILLED');

      return;
    }

    if (_killReason === 'HANGING_DEBUGGER') {
      _log.default.info(_log.default.chalk.red.dim.bold('Detected hanging debugger; process was killed.'));

      _setState('KILLED');

      return;
    }

    if (code !== 0 && signal === null) {
      if (_state === 'STOPPING') {
        _log.default.error(_log.default.chalk.red.bold('Process crashed while shutting-down.'));

        _setState('STOPPED');

        return;
      }

      if (_state === 'STARTED') {
        _log.default.error(_log.default.chalk.red.bold(`Process crashed. ${_log.default.chalk.dim(`(Code: ${code})`)}`));

        _setState('EXITED');

        return;
      }
    }

    if (code === 0 || code === null) {
      if (_state === 'STOPPING') {
        _log.default.info(_log.default.chalk.bold('Process shut-down gracefully.'));

        _setState('STOPPED');

        return;
      }

      if (_state === 'STARTED') {
        _log.default.info(_log.default.chalk.bold('Process exited cleanly.'));

        _setState('EXITED');

        return;
      }
    }

    throw new Error(`Unexpected code path in "close" handler. Exit code: ${code}; signal: ${signal}; State: ${_state}`);
  };

  const _killAfterGracePeriod = signal => {
    setTimeout(() => {
      if (processDescriptor.isClosed && processDescriptor.kill && !processDescriptor.isClosed() && _debuggerState === 'ATTACHED') {
        _killReason = 'PAUSED_DEBUGGER';
        void processDescriptor.kill('SIGKILL');
        return;
      }

      if (processDescriptor.isClosed && processDescriptor.kill && !processDescriptor.isClosed()) {
        _killReason = 'GRACE_PERIOD_EXPIRED';
        void processDescriptor.kill(signal);
        return;
      }
    }, _shutdownGracePeriod);
  };

  processDescriptor.getState = () => {
    return _state;
  };

  processDescriptor.isClosed = () => {
    return ['STOPPED', 'EXITED', 'KILLED'].includes(_state);
  };

  processDescriptor.awaitClosed = async () => {
    if (processDescriptor.isClosed) {
      return (0, _pWaitFor.default)(processDescriptor.isClosed);
    }
  };

  processDescriptor.kill = async signal => {
    _setState('STOPPING');

    _process.kill(signal);

    _killAfterGracePeriod('SIGKILL');

    if (processDescriptor.awaitClosed) {
      return processDescriptor.awaitClosed();
    }
  };

  _setState('STARTING');

  _process = (0, _execa.default)(bin, args, {
    stdio,
    detached: true
  });

  _process.catch(_handleError);

  void _process.on('message', _handleMessage);
  void _process.on('close', _handleClose);
  void _process.on('error', _handleError);

  if (_process.stdin) {
    process.stdin.pipe(_process.stdin);
  }

  if (_process.stdout) {
    _process.stdout.pipe(process.stdout);
  }

  if (_process.stderr) {
    _process.stderr.pipe(process.stderr);

    _process.stderr.on('data', _handleStderrData);
  } else if (bin.endsWith('node')) {
    _log.default.verbose('With current stdio configuration, Sentinelle will be unable to detect hanging/paused Node debugger instances.');
  }

  _setState('STARTED');

  return processDescriptor;
}

module.exports = exports.default;
//# sourceMappingURL=process-descriptor.js.map