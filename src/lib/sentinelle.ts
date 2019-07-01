import fs from 'fs';
import path from 'path';

import chokidar from 'chokidar';
import ow from 'ow';

import log from 'lib/log';
import ProcessDescriptorFactory, {ProcessDescriptor, ProcessDescriptorOptions} from 'lib/process-descriptor';
import {ensureArray, ensureBin, ensureFile, parseTime} from 'lib/utils';


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
  /**
   * @private
   *
   * (Optional) Name of the binary we will use to execute our entry file. This
   * will throw if the binary is not present.
   *
   * Default: node
   */
  ow(options.bin, 'bin', ow.any(ow.string, ow.undefined));
  const _bin = options.bin;
  log.silly('bin', _bin);

  /**
   * @private
   *
   * Name of the entrypoint for the process we will manage. This will throw if
   * the file is not present or is unreadable.
   */
  ow(options.entry, 'entry', ow.string);
  const _entry = options.entry;
  log.silly('entry', _entry);


  /**
   * @private
   *
   * (Optional) Additional arguments to pass to `entry`.
   */
  ow(options.entryArgs, 'entryArgs', ow.any(ow.undefined, ow.array.ofType(ow.string)));
  const _entryArgs = ensureArray(options.entryArgs);
  log.silly('entryArgs', _entryArgs);


  /**
   * @private
   *
   * (Optional) List of files/directories we will watch. By default, this always
   * contains the directory of our entry file. The user may provide additional
   * files or directories to watch with the "watch" option.
   */
  ow(options.watch, 'watch', ow.any(ow.array.ofType(ow.string), ow.undefined));
  const _watches = [path.resolve(path.dirname(_entry)), ...(options.watch || [])];
  log.silly('watches', _watches);


  /**
   * @private
   *
   * (Optional) How long to wait for a process to exit on its own after we issue
   * the configured shut-down signal. Once this period expires, the process will
   * be forfully terminaled.
   *
   * Default: '4 seconds'
   */
  ow(options.processShutdownGracePeriod, 'processShutdownGracePeriod', ow.any(ow.string, ow.number, ow.undefined));
  const _processShutdownGracePeriod = parseTime(options.processShutdownGracePeriod || '4 seconds');
  log.silly('gracePeriod', `${_processShutdownGracePeriod}ms`);


  /**
   * @private
   *
   * (Optional) Signal we will send to child processes to indicate we want them
   * to shut down.
   *
   * Default: SIGUSR2
   */
  ow(options.processShutdownSignal, 'processShutdownSignal', ow.any(ow.string, ow.undefined));
  const _processShutdownSignal = options.processShutdownSignal || 'SIGUSR2';
  log.silly('signal', _processShutdownSignal);


  /**
   * @private
   *
   * (Optional) Output options for spawned processes.
   */
  ow(options.stdio, 'stdio', ow.any(ow.undefined, ow.string, ow.array.ofType(ow.string)));
  const _stdio = options.stdio || ['inherit', 'inherit', 'pipe'];
  log.silly('stdio', _stdio);


  /**
   * @private
   *
   * Chokidar instance we will create when we start.
   */
  let _watcher: chokidar.FSWatcher | undefined;


  /**
   * @private
   *
   * Descriptor for the current managed process.
   */
  let _curProcess: ProcessDescriptor;


  // ----- Private Methods -----------------------------------------------------

  /**
   * @private
   *
   * Initializes file watchers.
   */
  function _initWatchers() {
    if (_watcher) {
      return;
    }

    // Ensure we aren't watching anything problematic.
    const filteredWatches = _watches.reduce((finalWatches, curWatch) => {
      if (curWatch === '/') {
        log.warn('', 'Refusing to recursively watch "/"; watching entry file instead.');
        return [_entry, ...finalWatches];
      }

      return [...finalWatches, curWatch];
    }, []);

    filteredWatches.forEach(watch => {
      const isDir = fs.statSync(watch).isDirectory();
      log.info('', log.chalk.bold(`Watching ${isDir ? 'directory' : 'file'}`), log.chalk.green(`${watch}`));
    });

    _watcher = chokidar.watch(filteredWatches);

    /**
     * Called every time we receive a `change` event on a file or directory we
     * are watching. This function must be implemented in a way that allows it
     * to be called numerous times, but will only call `startProcess` once, when
     * the last process has exited.
     */
    _watcher.on('change', async file => {
      // If there is no managed process running, start one.
      if (!_curProcess) {
        log.silly('change', 'No process running; starting process.');
        return startProcess();
      }

      // If the current process is in the... process... of shutting-down, bail.
      if (_curProcess.getState() === 'STOPPING') {
        log.silly('change', 'Process is still shutting-down; bailing.');
        return;
      }

      return restartProcess();
    });

    /**
     * Invoked when the watcher encounters an error.
     *
     * TODO: Consider handling this.
     */
    _watcher.on('error', err => {
      if (err && err.stack) {
        log.error('', 'Watcher error:', err.message);
        log.verbose('', err.stack.split('\n').slice(1).join('\n'));
      }
    });
  }


  /**
   * @private
   *
   * Sends a signal to the managed process and waits for it to become 'STOPPED'.
   */
  async function _stopProcess(signal: NodeJS.Signals = _processShutdownSignal): Promise<void> {
    // Bail if there is no process to stop.
    if (!_curProcess) {
      log.warn('', 'No process running.');
      return;
    }

    // If the process is in such a state that we don't need to stop it, bail.
    if (_curProcess.isClosed()) {
      log.verbose('', 'Process is already stopped; nothing to do.');
      return;
    }

    if (signal === 'SIGKILL') {
      log.info('', log.chalk.bold('Forcefully stopping process...'));
    } else {
      log.info('', log.chalk.bold('Stopping process...'));
    }

    log.silly('', `Sending signal ${log.chalk.yellow.bold(signal)} to process.`);

    const closedPromise = _curProcess.kill(signal);

    // Schedule the current process to be killed after the grace period.
    _curProcess.killAfterGracePeriod(_processShutdownGracePeriod || 0);

    await closedPromise;
  }


  // ----- Public Methods ------------------------------------------------------

  /**
   * Waits for any current managed process to become 'STOPPED', then starts a
   * new managed process and returns its process descriptor.
   */
  async function startProcess() {
    // Start watchers. If this has already been done, this will be a no-op.
    _initWatchers();

    // If there was an existing process, Wait until it stops.
    if (_curProcess && !_curProcess.isClosed()) {
      log.warn('startProcess', 'Waiting for process state to become "STOPPED".');
      await _curProcess.awaitClosed();
    }

    try {
      // Split-out "bin" from any arguments to be passed to it.
      const [bin, ...binArgs] = _bin ? _bin.split(' ') : ['', ''];

      // Split out "entry" from any arguments to be passed to it.
      const [entry, ...entryArgs] = _entry.split(' ');

      // If using the "bin" option, our final executable will be "bin".
      // Otherwise, use "entry" directly.
      const finalBin = bin ? ensureBin(bin) : ensureFile(entry);

      // If "bin" is being used, our final arguments array will consist of any
      // extra arguments to pass to "bin", then our "entry", then any extra
      // arguments to pass to "entry". If not using "bin", our final arguments
      // array is just any extra arguments to pass to "entry".
      const finalArgs = bin ? [...binArgs, entry, ...entryArgs] : entryArgs;

      // Build a string representing the command we will issue. We use the
      // original version of "bin" here rather than the full path to keep things
      // readable.
      const commandAsString = `${bin || entry} ${finalArgs.join(' ')}`;
      log.info('', log.chalk.bold('Starting'), log.chalk.green(commandAsString));

      // Create a new ProcessDescriptor.
      _curProcess = ProcessDescriptorFactory({bin: finalBin, args: finalArgs, stdio: _stdio});
    } catch (err) {
      log.error('', err.message);
      log.verbose('', err.stack.split('\n').slice(1).join('\n'));
    }
  }


  /**
   * Restarts the managed process.
   */
  async function restartProcess(signal: NodeJS.Signals = _processShutdownSignal) {
    // If no process has been started, bail.
    if (!_curProcess) {
      return;
    }

    // If the process is not closed, call stopProcess() and wait.
    if (!_curProcess.isClosed()) {
      await _stopProcess(signal);
    }

    await startProcess();
  }


  /**
   * Closes all file watchers and waits for the current process to close. An
   * optional signal may be provided which will be sent to the process.
   */
  async function stop(signal: NodeJS.Signals = _processShutdownSignal) {
    if (!_curProcess) {
      return;
    }

    log.verbose('', 'Shutting down.');

    // Close watchers.
    if (_watcher) {
      _watcher.close();
      _watcher = undefined;
      log.silly('', 'My watch has ended.');
    }

    // Close process.
    log.silly('', `Stopping process with signal ${log.chalk.bold(signal)}.`);
    await _stopProcess(signal);
  }


  return {
    start: startProcess,
    restart: restartProcess,
    stop
  };
}
