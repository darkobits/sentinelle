#!/usr/bin/env node
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _adeiu = _interopRequireDefault(require("@darkobits/adeiu"));

var _saffron = _interopRequireDefault(require("@darkobits/saffron"));

var _constants = require("../etc/constants");

var _sentinelle = _interopRequireDefault(require("../lib/sentinelle"));

var _log = _interopRequireDefault(require("../lib/log"));

var _utils = require("../lib/utils");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const initAdeiu = sentinelle => (0, _adeiu.default)(async signal => {
  _log.default.info(_log.default.chalk.bold(`Got signal ${signal}; shutting-down.`));

  const secondaryHandler = async () => {
    await sentinelle.stop('SIGKILL');
    process.off(signal, secondaryHandler);
    process.kill(process.pid, signal);
  };

  process.prependListener(signal, secondaryHandler);
  await sentinelle.stop();
});

_saffron.default.command({
  command: '* <entrypoint>',
  builder: ({
    command
  }) => {
    command.usage('Run a process, watch for file changes, and re-start the process.');
    command.positional('entrypoint', {
      description: 'Entrypoint to the script/application to run.',
      type: 'string',
      required: true
    });
    command.option('bin', {
      description: 'Optional binary (and any arguments to pass to it) to use to execute the entry file.',
      type: 'string',
      required: false
    });
    command.option('watch', {
      description: 'Directory to watch for file changes. Defaults to the directory of the entry file.',
      type: 'string',
      coerce: arg => Array.isArray(arg) ? arg : [arg],
      required: false
    });
    command.option('kill', {
      description: 'POSIX signal to send to a process when we need it to shut-down.',
      type: 'string',
      default: _constants.DEFAULT_KILL_SIGNAL,
      required: false
    });
    command.option('quiet', {
      description: 'Suppress all logging except errors and warnings.',
      type: 'boolean',
      default: false,
      required: false
    });
    command.example('$0 src/main.js', 'Execute "src/main.js" using Node, watch "src", and re-run when files change.');
    command.example('$0 --watch /some/dir --bin python /my/script.py', 'Execute "/my/script.py" using Python, watch "/some/dir", and re-run when files change.');
    return command;
  },
  handler: async ({
    argv
  }) => {
    try {
      const {
        entrypoint: entry,
        bin,
        watch,
        kill: processShutdownSignal,
        quiet
      } = argv;

      if (quiet) {
        _log.default.configure({
          level: 'warn'
        });
      }

      const sentinelle = (0, _sentinelle.default)({
        bin,
        entry,
        watch,
        processShutdownSignal
      });
      initAdeiu(sentinelle);
      process.on('unhandledRejection', err => {
        _log.default.verbose('Unhandled rejection:', err);
      });

      if (_log.default.isLevelAtLeast('verbose')) {
        const version = await (0, _utils.getPackageVersion)();

        _log.default.verbose(_log.default.prefix('version'), _log.default.chalk.green.bold(version));
      }

      await sentinelle.start();
    } catch (err) {
      _log.default.error(err.message);

      _log.default.verbose(err.stack.split('\n').slice(1).join('\n'));

      process.exit(1);
    }
  }
});

var _default = _saffron.default.init();

exports.default = _default;
module.exports = exports.default;
//# sourceMappingURL=cli.js.map