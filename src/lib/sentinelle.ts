import {spawn} from 'child_process';
import fs from 'fs';
import path from 'path';

import chokidar from 'chokidar';
import ow from 'ow';
import pWaitFor from 'p-wait-for';

import log from 'lib/log';
import {ensureBin, ensureFile, parseTime} from 'lib/utils';
import {ProcessDescriptor, ProcessState, SentinelleOptions} from 'etc/types';


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
  const processShutdownSignal = options.processShutdownSignal || 'SIGINT';
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
   * Returns a new process descriptor representing a managed process and its
   * state.
   */
  function ProcessDescriptorFactory(): ProcessDescriptor {
    // Closure-bound source-of-truth for the descriptor's `state` property.
    let state: ProcessState;

    const pd: ProcessDescriptor = {
      handle: spawn(bin, args, {stdio: spawnStdio}),
      get state() {
        return state;
      },
      set state(newState: ProcessState) {
        state = newState;
        log.silly('', `Set process state to ${log.chalk.bold(newState)}.`);
      }
    };

    pd.state = 'STARTING';

    // Handle the "message" event.
    pd.handle.on('message', message => {
      log.silly('process', message);
    });

    // Handle the "close" event.
    pd.handle.on('close', (code, signal) => {
      const finalProcessState = parseProcessCloseEvent(code, signal, pd);
      pd.state = finalProcessState;
    });

    // Handle the "error" event.
    pd.handle.on('error', err => {
      if (err && err.stack) {
        log.error('', 'Child process error:', err.message);
        log.verbose('', err.stack.split('\n').slice(1).join('\n'));
      }
    });

    // If the default `pipe` option was used, pipe the child process' output to
    // the parent process' output.
    if (pd.handle.stdout) {
      pd.handle.stdout.pipe(process.stdout);
    }

    if (pd.handle.stderr) {
      pd.handle.stderr.pipe(process.stderr);

      /**
       * F.A.Q.
       *
       * Q: What all this, then?
       *
       * A: So, when our child process is run with the --inspect (or similar)
       *    flags, the process does not organically close when the main thread
       *    dies because Node keeps the debugger alive. This issue should have
       *    been fixed by [1], but still persists even in Node 10.
       *
       * [1]: https://github.com/nodejs/node/issues/7742
       */
      pd.handle.stderr.on('data', chunk => {
        if (/Waiting for the debugger to disconnect/ig.test(Buffer.from(chunk).toString('utf8'))) {
          log.silly('', 'Detected a hanging debugger instance.');
          pd.killReason = 'HANGING_DEBUGGER';
          pd.handle.kill('SIGTERM');
        }
      });
    } else {
      log.verbose('', 'With current stdio configuration, Sentinelle will be unable to detect hanging debugger instances.');
    }

    pd.state = 'STARTED';

    return pd;
  }


  /**
   * Provided a code, signal, and a process descriptor `state`, determines what
   * the next process descriptor `state` should be based on how the process
   * closed. Also responsible for messaging this to the user.
   *
   * - A `null` signal means the child process exited normally.
   * - A `0` or `null` code means the process exited normally.
   */
  function parseProcessCloseEvent(code: number, signal: string, pd: ProcessDescriptor) {
    // ----- Exotic Unstable Exits ---------------------------------------------

    if (pd.killReason === 'GRACE_PERIOD_EXPIRED') {
      // Process took longer than the grace period to shut-down.
      log.error('', log.chalk.red.bold('Process failed to shut-down in time and was killed.'));
      return 'KILLED';
    }

    if (pd.killReason === 'HANGING_DEBUGGER') {
      // Process had a hanging debugger instnace attached and failed to
      // shut-down.
      log.error('', log.chalk.red.bold('Detected hanging debugger; process was killed.'));
      return 'KILLED';
    }


    // ----- Unstable Exits ----------------------------------------------------

    if (code !== 0 && signal === null) {
      if (pd.state === 'STOPPING') {
        // Process was issued an interrupt signal and crashed within the grace
        // period.
        log.error('', log.chalk.red.bold('Process crashed while shutting-down.'));
        return 'STOPPED';
      }

      if (pd.state === 'STARTED') {
        // Process crashed on its own without requiring an interrupt signal.
        log.error('', log.chalk.red.bold('Process crashed.'));
        return 'EXITED';
      }
    }


    // ----- Clean Exits -------------------------------------------------------

    if (code === 0 || code === null) {
      if (pd.state === 'STOPPING') {
        // Process was issued an interrupt signal and closed cleanly within the
        // grace period.
        log.info('', log.chalk.bold('Process shut-down gracefully.'));
        return 'STOPPED';
      }

      if (pd.state === 'STARTED') {
        // Process exited cleanly on its own without requiring an interrupt
        // signal.
        log.info('', log.chalk.bold('Process exited cleanly.'));
        return 'EXITED';
      }
    }

    throw new Error(`Unexpected code path in "close" handler. Exit code: ${code}; signal: ${signal}; State: ${pd.state}`);
  }


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
      if (curProcess.state === 'STOPPING') {
        log.silly('change', 'Process is still shutting-down; bailing.');
        return;
      }

      // If the process is otherwise not closed, call stopProcess() and wait.
      if (!['STOPPED', 'EXITED', 'KILLED'].includes(curProcess.state)) {
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
   * Sets a timeout that resolves after the grace period and then kills the
   * provided process if it is not already in a closed state.
   */
  function killAfterGracePeriod(pd: ProcessDescriptor): void {
    setTimeout(() => {
      if (!['STOPPED', 'EXITED', 'KILLED'].includes(pd.state)) {
        log.warn('', 'Grace period expired, sending SIGTERM to process.');
        pd.killReason = 'GRACE_PERIOD_EXPIRED';
        pd.handle.kill('SIGTERM');
      }
    }, processShutdownGracePeriod || 0);
  }


  /**
   * Waits for any current managed process to become 'STOPPED', then starts a
   * new managed process and returns its process descriptor.
   */
  async function startProcess() {
    // Start watchers. If this has already been done, this will be a no-op.
    initWatchers();

    // If there was an existing process, Wait until it stops.
    if (curProcess && !['STOPPED', 'EXITED', 'KILLED'].includes(curProcess.state)) {
      log.warn('startProcess', 'Waiting for process state to become "STOPPED".');
      await pWaitFor(() => ['STOPPED', 'EXITED', 'KILLED'].includes(curProcess.state));
    }

    try {
      const commandAsString = `${bin.split(path.sep).slice(-1)} ${args.join(' ')}`;
      log.info('', log.chalk.bold('Starting:'), log.chalk.green(commandAsString));
      const pd = ProcessDescriptorFactory();
      curProcess = pd;
      return pd.handle;
    } catch (err) {
      log.error('', err);
    }
  }


  /**
   * Sends a signal to the managed process and waits for it to become 'STOPPED'.
   */
  async function stopProcess(signal: NodeJS.Signals = 'SIGINT'): Promise<void> {
    // Bail if there is no process to stop.
    if (!curProcess) {
      log.warn('', 'No process running.');
      return;
    }

    // If the process is in such a state that we don't need to stop it, bail.
    if (['STOPPED', 'EXITED', 'KILLED'].includes(curProcess.state)) {
      log.warn('', 'Process is already stopped; nothing to do.');
      return;
    }

    // If the process is already stopping, bail.
    if (curProcess.state === 'STOPPING') {
      log.warn('', 'Process is already stopping; nothing to do.');
      return;
    }

    log.info('', log.chalk.bold('Stopping process...'));
    log.silly('', `Sending signal ${log.chalk.yellow.bold(signal)} to process.`);

    curProcess.state = 'STOPPING';
    curProcess.handle.kill(signal);

    // Schedule the current process to be killed after the grace period.
    killAfterGracePeriod(curProcess);

    await pWaitFor(() => ['STOPPED', 'EXITED', 'KILLED'].includes(curProcess.state));
  }


  /**
   * Closes all file watchers and waits for the current process to close. An
   * optional signal may be provided which will be sent to the process.
   */
  async function stop(signal: NodeJS.Signals = 'SIGINT') {
    log.verbose('', 'Shutting down.');

    // Close watchers.
    watcher.close();
    log.silly('', 'Watchers closed.');

    // Close process.
    log.silly('', `Stopping process with signal ${log.chalk.bold(signal)}`);
    await stopProcess(signal);
    log.silly('', 'Process closed.');

    log.verbose('', 'Done.');
  }


  return {start: startProcess, stop};
}
