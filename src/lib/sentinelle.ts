import fs from 'fs';
import path from 'path';

import chokidar from 'chokidar';
import ow from 'ow';

import {
  DEFAULT_KILL_SIGNAL,
  DEFAULT_SHUTDOWN_GRACE_PERIOD
} from 'etc/constants';
import log from 'lib/log';
import ProcessDescriptorFactory, {
  ProcessDescriptor,
  ProcessDescriptorOptions
} from 'lib/process-descriptor';
import {
  ensureArray,
  ensureBin,
  ensureFile,
  parseTime
} from 'lib/utils';


/**
 * Options that may be provided to `SentinelleFactory`.
 */
export interface SentinelleOptions {
  /**
   * Entry file for the application or script to manage.
   */
  entry: string;

  /**
   * (Optional) Additional arguments to pass to `entry`.
   */
  entryArgs?: Array<string>;

  /**
   * (Optional) Binary to use to run the application or script.
   *
   * Default: node
   */
  bin?: string;

  /**
   * (Optional) Extra files or directories to watch in addition to "entry".
   */
  watch?: Array<string>;

  /**
   * (Optional) Time to wait after issuing an interrupt signal to a process
   * before killing it.
   *
   * Default: 4 seconds
   */
  processShutdownGracePeriod?: number | string;

  /**
   * (Optional) Signal to use when shutting-down processes.
   *
   * Default: SIGINT
   */
  processShutdownSignal?: NodeJS.Signals;

  /**
   * (Optional) Output configuration for processes.
   *
   * Default: 'inherit'
   */
  stdio?: ProcessDescriptorOptions['stdio'];
}


/**
 * Object returned by SentinelleFactory.
 */
export interface Sentinelle {
  /**
   * Waits for any current managed process to become 'STOPPED', then starts a
   * new managed process and returns its process descriptor.
   */
  start(): Promise<void>;

  /**
   * Restarts the managed process.
   */
  restart(signal?: NodeJS.Signals): Promise<void>;

  /**
   * Closes all file watchers and waits for the current process to close. An
   * optional signal may be provided which will be sent to the process.
   */
  stop(signal?: NodeJS.Signals): Promise<void>;
}


/**
 * Creates a new Sentinelle that will watch a set of files and (re)start a
 * process when they change.
 *
 * TODO: Add our own SIGINT handler to gracefully shut-down the process before
 * exiting.
 */
export default function SentinelleFactory(options: SentinelleOptions): Sentinelle {
  const sentinelle: Partial<Sentinelle> = {};


  /**
   * @private
   *
   * (Optional) Name of the binary we will use to execute our entry file. This
   * will throw if the binary is not present.
   */
  ow(options.bin, 'bin', ow.any(ow.string, ow.undefined));
  const bin = options.bin;
  log.silly(log.prefix('bin'), bin);

  /**
   * @private
   *
   * Name of the entrypoint for the process we will manage. This will throw if
   * the file is not present or is unreadable.
   */
  ow(options.entry, 'entry', ow.string);
  const entry = options.entry;
  log.silly(log.prefix('entry'), entry);


  /**
   * @private
   *
   * (Optional) Additional arguments to pass to `entry`.
   */
  ow(options.entryArgs, 'entryArgs', ow.any(ow.undefined, ow.array.ofType(ow.string)));
  const entryArgs = ensureArray(options.entryArgs);
  log.silly(log.prefix('entryArgs'), entryArgs);


  /**
   * @private
   *
   * (Optional) List of files/directories we will watch. By default, this always
   * contains the directory of our entry file. The user may provide additional
   * files or directories to watch with the "watch" option.
   */
  ow(options.watch, 'watch', ow.any(ow.array.ofType(ow.string), ow.undefined));
  const watches = [path.resolve(path.dirname(entry)), ...options.watch ?? []];
  log.silly(log.prefix('watches'), watches);


  /**
   * @private
   *
   * (Optional) How long to wait for a process to exit on its own after we issue
   * the configured shut-down signal. Once this period expires, the process will
   * be forcefully terminated.
   *
   * Default: '4 seconds'
   */
  ow(options.processShutdownGracePeriod, 'processShutdownGracePeriod', ow.any(ow.string, ow.number, ow.undefined));
  const processShutdownGracePeriod = parseTime(options.processShutdownGracePeriod ?? DEFAULT_SHUTDOWN_GRACE_PERIOD) as number;
  log.silly(log.prefix('gracePeriod'), `${processShutdownGracePeriod}ms`);


  /**
   * @private
   *
   * (Optional) Signal we will send to child processes to indicate we want them
   * to shut down.
   *
   * Default: SIGINT
   */
  ow(options.processShutdownSignal, 'processShutdownSignal', ow.any(ow.string, ow.undefined));
  const processShutdownSignal = options.processShutdownSignal ?? DEFAULT_KILL_SIGNAL;
  log.silly(log.prefix('signal'), processShutdownSignal);


  /**
   * @private
   *
   * (Optional) Output options for spawned processes.
   */
  ow(options.stdio, 'stdio', ow.any(ow.undefined, ow.string, ow.array.ofType(ow.string)));
  const stdio = options.stdio ?? ['inherit', 'inherit', 'pipe'];
  log.silly(log.prefix('stdio'), stdio);


  /**
   * @private
   *
   * Chokidar instance we will create when we start.
   */
  let watcher: chokidar.FSWatcher | undefined;


  /**
   * @private
   *
   * Descriptor for the current managed process.
   */
  let curProcess: ProcessDescriptor;


  // ----- Private Methods -----------------------------------------------------

  /**
   * @private
   *
   * Initializes file watchers.
   */
  const initWatchers = () => {
    if (watcher) {
      return;
    }

    // Ensure we aren't watching anything problematic.
    const filteredWatches = watches.reduce<Array<string>>((finalWatches, curWatch) => {
      if (curWatch === '/') {
        log.warn('Refusing to recursively watch "/"; watching entry file instead.');
        return [entry, ...finalWatches];
      }

      return [...finalWatches, curWatch];
    }, []);

    filteredWatches.forEach(watch => {
      const isDir = fs.statSync(watch).isDirectory();
      log.info(log.chalk.bold(`Watching ${isDir ? 'directory' : 'file'}`), log.chalk.green(`${watch}`));
    });

    watcher = chokidar.watch(filteredWatches);

    /**
     * Called every time we receive a `change` event on a file or directory we
     * are watching. This function must be implemented in a way that allows it
     * to be called numerous times, but will only call `startProcess` once, when
     * the last process has exited.
     */
    watcher.on('change', () => {
      // If there is no managed process running, start one.
      if (!curProcess) {
        log.silly(log.prefix('change'), 'No process running; starting process.');

        if (typeof sentinelle.start === 'function') {
          void sentinelle.start();
        }

        return;
      }

      // If the current process is in the... process... of shutting-down, bail.
      if (curProcess.getState() === 'STOPPING') {
        log.silly(log.prefix('change'), 'Process is still shutting-down; bailing.');
        return;
      }

      if (typeof sentinelle.restart === 'function') {
        void sentinelle.restart();
      }

      return;
    });

    /**
     * Invoked when the watcher encounters an error.
     *
     * TODO: Consider handling this.
     */
    watcher.on('error', err => {
      if (err?.stack) {
        log.error('Watcher error:', err.message);
        log.verbose(err.stack.split('\n').slice(1).join('\n'));
      }
    });
  };


  /**
   * @private
   *
   * Sends a signal to the managed process and waits for it to become 'STOPPED'.
   */
  const stopProcess = async (signal: NodeJS.Signals = processShutdownSignal): Promise<void> => {
    // Bail if there is no process to stop.
    if (!curProcess) {
      log.warn('No process running.');
      return;
    }

    // If the process is in such a state that we don't need to stop it, bail.
    if (curProcess.isClosed()) {
      log.verbose('Process is already stopped; nothing to do.');
      return;
    }

    if (signal === 'SIGKILL') {
      log.info(log.chalk.bold('Forcefully stopping process...'));
    } else {
      log.info(log.chalk.bold('Stopping process...'));
    }

    log.silly(`Sending signal ${log.chalk.yellow.bold(signal)} to process.`);

    await curProcess.kill(signal);
  };


  // ----- Public Methods ------------------------------------------------------

  /**
   * Waits for any current managed process to become 'STOPPED', then starts a
   * new managed process and returns its process descriptor.
   */
  sentinelle.start = async () => {
    // Start watchers. If this has already been done, this will be a no-op.
    initWatchers();

    // If there was an existing process, Wait until it stops.
    if (curProcess && !curProcess.isClosed()) {
      log.warn(log.prefix('startProcess'), 'Waiting for process state to become "STOPPED".');
      await curProcess.awaitClosed();
    }

    try {
      // Split-out "bin" from any arguments to be passed to it.
      const [splitBin, ...binArgs] = bin ? bin.split(' ') : ['', ''];

      // Split out "entry" from any arguments to be passed to it.
      const [splitEntry, ...entryArgs] = entry.split(' ');

      // If using the "bin" option, our final executable will be "bin".
      // Otherwise, use "entry" directly.
      const finalBin = splitBin ? ensureBin(splitBin) : ensureFile(splitEntry);

      // If "bin" is being used, our final arguments array will consist of any
      // extra arguments to pass to "bin", then our "entry", then any extra
      // arguments to pass to "entry". If not using "bin", our final arguments
      // array is just any extra arguments to pass to "entry".
      const finalArgs = splitBin ? [...binArgs, splitEntry, ...entryArgs] : entryArgs;

      // Build a string representing the command we will issue. We use the
      // original version of "bin" here rather than the full path to keep things
      // readable.
      const commandAsString = `${bin ?? entry} ${finalArgs.join(' ')}`;
      log.info(log.chalk.bold('Starting'), log.chalk.green(commandAsString));

      // Create a new ProcessDescriptor.
      // eslint-disable-next-line require-atomic-updates
      curProcess = ProcessDescriptorFactory({
        bin: finalBin,
        args: finalArgs,
        stdio: stdio,
        shutdownGracePeriod: processShutdownGracePeriod
      });
    } catch (err) {
      log.error(err.message);
      log.verbose(err.stack.split('\n').slice(1).join('\n'));
    }
  };


  /**
   * Restarts the managed process.
   */
  sentinelle.restart = async (signal: NodeJS.Signals = processShutdownSignal) => {
    // If no process has been started, bail.
    if (!curProcess) {
      return;
    }

    // If the process is not closed, call stopProcess() and wait.
    if (!curProcess.isClosed()) {
      await stopProcess(signal);
    }

    if (typeof sentinelle.start === 'function') {
      await sentinelle.start();
    }
  };


  /**
   * Closes all file watchers and waits for the current process to close. An
   * optional signal may be provided which will be sent to the process.
   */
  sentinelle.stop = async (signal: NodeJS.Signals = processShutdownSignal) => {
    if (!curProcess) {
      return;
    }

    log.verbose('Shutting down.');

    // Close watchers.
    if (watcher) {
      await watcher.close();
      // eslint-disable-next-line require-atomic-updates
      watcher = undefined;
      log.silly('My watch has ended.');
    }

    // Close process.
    log.silly(`Stopping process with signal ${log.chalk.bold(signal)}.`);
    await stopProcess(signal);
  };


  return sentinelle as Required<Sentinelle>;
}
