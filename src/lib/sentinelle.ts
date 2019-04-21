
import {SpawnOptions} from 'child_process';
import fs from 'fs';
import path from 'path';

import chokidar from 'chokidar';
import ow from 'ow';

import log from 'lib/log';
import ProcessDescriptorFactory, {ProcessDescriptor} from 'lib/process-descriptor';
import {ensureBin, ensureFile, parseTime} from 'lib/utils';


/**
 * Options that may be provided to `SentinelleFactory`.
 */
export interface SentinelleOptions {
  /**
   * Entry file for the application or script to manage.
   */
  entry: string;

  /**
   * (Optional) Binary to use to run the application or script.
   *
   * Default: node
   */
  bin?: string;

  /**
   * (Optional) Extra arguments to pass to "bin".
   */
  extraArgs?: Array<string>;

  /**
   * (Optional) Extra files or directories to watch in addition to "entry".
   */
  watch?: Array<string>;

  /**
   * (Optional) Time to wait after issuing an interrupt signal to a process
   * before killing it.
   *
   * Default: 6 seconds
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
  stdio?: SpawnOptions['stdio'];
}


/**
 * Creates a new Sentinelle that will watch a set of files and (re)start a
 * process when they change.
 *
 * TODO: Add our own SIGINT handler to gracefully shut-down the process before
 * exiting.
 */
export default function SentinelleFactory(options: SentinelleOptions) {
  // Validate options.
  ow(options.entry, 'entry', ow.string);
  ow(options.bin, 'bin', ow.any(ow.string, ow.undefined));
  ow(options.extraArgs, 'extra arguments', ow.any(ow.array, ow.undefined));
  ow(options.watch, 'watchs', ow.any(ow.array, ow.undefined));
  ow(options.processShutdownGracePeriod, 'process shutdown grace period', ow.any(ow.string, ow.number, ow.undefined));
  ow(options.processShutdownSignal, 'process shutdown signal', ow.any(ow.string, ow.undefined));
  ow(options.stdio, 'stdio configuration', ow.any(ow.string, ow.array, ow.undefined));


  /**
   * Name of the binary we will use to execute our entry file.
   *
   * This will throw if the binary is not present.
   *
   * Default: node
   */
  const bin = ensureBin(options.bin || 'node');
  log.silly('bin', bin);


  /**
   * Name of the entrypoint for the process we will manage.
   *
   * This will throw if the file is not present or is unreadable.
   */
  const entry = ensureFile(options.entry);
  log.silly('entry', entry);


  /**
   * Array of any extra arguments to pass to the configured binary, followed by
   * the path to the configured entrypoint.
   */
  const args = [...(options.extraArgs || []), entry];


  /**
   * List of files/directories we will watch. By default, this always contains
   * the directory of our entry file. The user may provide additional files or
   * directories to watch with the "watch" option.
   */
  const watches = [path.resolve(path.dirname(entry)), ...(options.watch || [])];
  log.silly('watches', watches);


  /**
   * How long to wait for a process to exit on its own after we issue the
   * configured shut-down signal. Once this period expires, the process will be
   * forfully terminaled.
   */
  const processShutdownGracePeriod = parseTime(options.processShutdownGracePeriod || '4 seconds');
  log.silly('gracePeriod', `${processShutdownGracePeriod}ms`);


  /**
   * Signal we will send to child processes to indicate we want them to shut
   * down.
   */
  const processShutdownSignal = options.processShutdownSignal || 'SIGUSR2';
  log.silly('signal', processShutdownSignal);


  /**
   * Output options for spawned processes.
   */
  const spawnStdio = options.stdio || 'pipe';
  log.silly('stdio', spawnStdio);


  /**
   * Chokidar instance we will create when we start.
   */
  let watcher: chokidar.FSWatcher;


  /**
   * Descriptor for the current managed process.
   */
  let curProcess: ProcessDescriptor;


  /**
   * Initializes file watchers.
   */
  function initWatchers() {
    if (watcher) {
      return;
    }

    // Ensure we aren't watching anything problematic.
    const filteredWatches = watches.reduce((finalWatches, curWatch) => {
      if (curWatch === '/') {
        log.warn('', 'Refusing to recursively watch "/"; watching entry file instead.');
        return [entry, ...finalWatches];
      }

      return [...finalWatches, curWatch];
    }, []);

    filteredWatches.forEach(watch => {
      const isDir = fs.statSync(watch).isDirectory();
      log.info('', log.chalk.bold(`Watching ${isDir ? 'directory' : 'file'}:`), log.chalk.green(`${watch}`));
    });

    watcher = chokidar.watch(filteredWatches);

    /**
     * Called every time we receive a `change` event on a file or directory we
     * are watching. This function must be implemented in a way that allows it
     * to be called numerous times, but will only call `startProcess` once, when
     * the last process has exited.
     */
    watcher.on('change', async file => {
      // If there is no managed process running, start one.
      if (!curProcess) {
        log.silly('change', 'No process running; starting process.');
        return startProcess();
      }

      // If the current process is in the... process... of shutting-down, bail.
      if (curProcess.getState() === 'STOPPING') {
        log.silly('change', 'Process is still shutting-down; bailing.');
        return;
      }

      // If the process is otherwise not closed, call stopProcess() and wait.
      if (!curProcess.isClosed()) {
        await stopProcess(processShutdownSignal);
      }

      // Finally, call startProcess() to start a new process.
      return startProcess();
    });

    /**
     * Invoked when the watcher encounters an error.
     *
     * TODO: Consider handling this.
     */
    watcher.on('error', err => {
      if (err && err.stack) {
        log.error('', 'Watcher error:', err.message);
        log.verbose('', err.stack.split('\n').slice(1).join('\n'));
      }
    });
  }


  /**
   * Waits for any current managed process to become 'STOPPED', then starts a
   * new managed process and returns its process descriptor.
   */
  async function startProcess() {
    // Start watchers. If this has already been done, this will be a no-op.
    initWatchers();

    // If there was an existing process, Wait until it stops.
    if (curProcess && !curProcess.isClosed()) {
      log.warn('startProcess', 'Waiting for process state to become "STOPPED".');
      await curProcess.awaitClosed();
    }

    try {
      const commandAsString = `${bin.split(path.sep).slice(-1)} ${args.join(' ')}`;
      log.info('', log.chalk.bold('Starting:'), log.chalk.green(commandAsString));
      curProcess = ProcessDescriptorFactory({bin, args, stdio: spawnStdio});
    } catch (err) {
      log.error('', err);
    }
  }


  /**
   * Sends a signal to the managed process and waits for it to become 'STOPPED'.
   */
  async function stopProcess(signal: NodeJS.Signals = processShutdownSignal): Promise<void> {
    // Bail if there is no process to stop.
    if (!curProcess) {
      log.warn('', 'No process running.');
      return;
    }

    // If the process is in such a state that we don't need to stop it, bail.
    if (curProcess.isClosed()) {
      log.warn('', 'Process is already stopped; nothing to do.');
      return;
    }

    // If the process is already stopping, bail.
    if (curProcess.getState() === 'STOPPING') {
      log.warn('', 'Process is already stopping; nothing to do.');
      return;
    }

    log.info('', log.chalk.bold('Stopping process...'));
    log.silly('', `Sending signal ${log.chalk.yellow.bold(signal)} to process.`);

    const closedPromise = curProcess.kill(signal);

    // Schedule the current process to be killed after the grace period.
    curProcess.killAfterGracePeriod(processShutdownGracePeriod || 0);

    await closedPromise;
  }


  /**
   * Closes all file watchers and waits for the current process to close. An
   * optional signal may be provided which will be sent to the process.
   */
  async function stop(signal: NodeJS.Signals = processShutdownSignal) {
    if (!curProcess) {
      return;
    }

    log.verbose('', 'Shutting down.');

    // Close watchers.
    watcher.close();
    log.silly('', 'My watch has ended.');

    // Close process.
    log.silly('', `Stopping process with signal ${log.chalk.bold(signal)}`);
    await stopProcess(signal);
    log.silly('', 'Process closed.');

    log.verbose('', 'Done.');
  }


  return {start: startProcess, stop};
}
