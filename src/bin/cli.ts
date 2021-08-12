#!/usr/bin/env node

import adeiu from '@darkobits/adeiu';
import cli from '@darkobits/saffron';

import { DEFAULT_KILL_SIGNAL } from 'etc/constants';
import { SentinelleArguments } from 'etc/types';
import SentinelleFactory from 'lib/sentinelle';
import log from 'lib/log';
import { getPackageVersion } from 'lib/utils';


/**
 * Initializer for shutdown handlers.
 */
const initAdeiu = (sentinelle: ReturnType<typeof SentinelleFactory>) => adeiu(async signal => {
  log.info(log.chalk.bold(`Got signal ${signal}; shutting-down.`));

  // Register a second handler on the same signal we just received that
  // will force-kill the process. This way, if a process is still within
  // the grace period when the user issues a second SIGINT, for example,
  // we just kill the process immediately and exit.
  const secondaryHandler = async () => {
    await sentinelle.stop('SIGKILL');

    // Un-register this handler to prevent recursion.
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    process.off(signal, secondaryHandler);

    // Kill the process with the same signal we received.
    process.kill(process.pid, signal);
  };

  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  process.prependListener(signal, secondaryHandler);

  await sentinelle.stop();
});


// ----- Command: Default ------------------------------------------------------

cli.command<SentinelleArguments>({
  command: '* <entrypoint>',
  builder: ({ command }) => {
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
      coerce: arg => (arg ? Array.isArray(arg) ? arg : [arg] : []),
      required: false
    });

    command.option('kill', {
      description: 'POSIX signal to send to a process when we need it to shut-down.',
      type: 'string',
      default: DEFAULT_KILL_SIGNAL,
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
  handler: async ({ argv }) => {
    try {
      const {
        entrypoint: entry,
        bin,
        watch,
        kill: processShutdownSignal,
        quiet
      } = argv;

      if (quiet) {
        log.configure({level: 'warn'});
      }

      // Create a Sentinelle instance.
      const sentinelle = SentinelleFactory({bin, entry, watch, processShutdownSignal});

      // Setup signal handler.
      initAdeiu(sentinelle);

      // Set up unhandled rejection handler. These can come from child process
      // event emitters, even though we have proper error handlers set up on
      // them.
      process.on('unhandledRejection', err => {
        log.verbose('Unhandled rejection:', err);
      });

      // Log current version for debugging.
      if (log.isLevelAtLeast('verbose')) {
        const version = await getPackageVersion();
        log.verbose(log.prefix('version'), log.chalk.green.bold(version));
      }

      // Start Sentinelle.
      await sentinelle.start();
    } catch (err) {
      log.error(err.message);
      log.verbose(err.stack.split('\n').slice(1).join('\n'));
      process.exit(1);
    }
  }
});


export default cli.init();
