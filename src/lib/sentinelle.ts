import {spawn} from 'child_process';
import fs from 'fs';
import path from 'path';

import sleep from '@darkobits/sleep';
import chokidar from 'chokidar';
import ow from 'ow';
import pWaitFor from 'p-wait-for';

import log from 'lib/log';
import {ensureBin, ensureFile, parseTime} from 'lib/utils';
import {ProcessDescriptor, ProcessState, SentinelleOptions} from 'etc/types';


/**
 * Creates a new Sentinelle that will watch a set of files and (re)start a
 * process when they change.
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
   * Path to the file we will run using the configured executable.
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
  const spawnStdio = options.stdio || 'inherit';
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
   * Provided a code, signal, and previous process descriptor "state",
   * determines what value to set as the new process descriptor's state based on
   * how the process closed.
   */
  function parseProcessCloseEvent(code: number, signal: string, processDescriptorState: ProcessDescriptor['state']) {
    if (code === 0 && signal === null) {
      if (processDescriptorState === 'STOPPING') {
        // Process was issued an interrupt signal and closed cleanly within the
        // grace period.
        log.info('', 'Process shut-down gracefully.');
        return 'STOPPED';
      }

      if (processDescriptorState === 'STARTED') {
        // Process exited cleanly on its own without requiring an interrupt
        // signal.
        log.info('', 'Process exited cleanly.');
        return 'EXITED';
      }
    }

    if (code !== 0 && signal === null) {
      if (processDescriptorState === 'STOPPING') {
        // Process was issued an interrupt signal and crashed within the grace
        // period.
        log.error('close', 'Process crashed during shut-down.');
        return 'STOPPED';
      }

      if (processDescriptorState === 'STARTED') {
        // Process crashed on its own without requiring an interrupt signal.
        log.error('close', 'Process crashed.');
        return 'EXITED';
      }
    }

    if (code === null && signal !== null) {
      // Process was issued an interrupt signal and did not respond within the
      // grace period.
      log.error('', 'Process failed to shut-down in time and was killed.');
      return 'KILLED';
    }

    throw new Error(`Unexpected code path in "close" handler. Exit code: ${code}; signal: ${signal}`);
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

    log.silly('filteredWatches', filteredWatches);

    watcher = chokidar.watch(filteredWatches);

    watches.forEach(watch => {
      const isDir = fs.statSync(watch).isDirectory();
      log.info('', `Watching ${isDir ? 'directory' : 'file'}: ${log.chalk.green(`${watch}`)}`);
    });

    watcher.on('change', async file => {
      // If there is no process, start a new one.
      if (!curProcess) {
        log.silly('change', 'No process running; starting process.');
        return startProcess();
      }

      // Bail if the current process is in the process of shutting-down.
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

    watcher.on('error', err => {
      if (err && err.stack) {
        log.error('watcher', err.stack);
      }
    });
  }


  /**
   * Returns a new process descriptor representing a managed process and its
   * state.
   */
  function ProcessDescriptorFactory(): ProcessDescriptor {
    const pd = {
      handle: spawn(bin, args, {stdio: spawnStdio}),
      get state() {
        return this._state;
      },
      set state(newState: ProcessState) {
        this._state = newState;
        log.silly('', `Set process state to ${log.chalk.bold(newState)}.`);
      }
    };

    pd.state = 'STARTING';

    pd.handle.on('message', message => {
      log.silly('process', message);
    });

    // Handle the "close" event.
    pd.handle.on('close', (code, signal) => {
      const finalProcessState = parseProcessCloseEvent(code, signal, pd.state);
      pd.state = finalProcessState;
    });

    // Handle the "error" event.
    pd.handle.on('error', err => {
      log.error('', 'Child process error:', err);
    });

    pd.state = 'STARTED';

    return pd;
  }


  /**
   * Waits for the process state to become 'STOPPED', then starts a new managed
   * process. If/when the process exits, process state state will be updated.
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
      log.info('', `Starting: ${log.chalk.green(commandAsString)}`);
      const pd = ProcessDescriptorFactory();
      curProcess = pd;
      return pd.handle;
    } catch (err) {
      log.error('', err);
    }
  }


  /**
   * Sends a signal to the managed process and waits for the instance's state
   * variable to update to 'STOPPED'.
   */
  async function stopProcess(signal: NodeJS.Signals = 'SIGINT'): Promise<void> {
    // Bail if there is no process to stop.
    if (!curProcess) {
      log.warn('', 'No process running.');
      return;
    }

    // Bail if the process is in such a state that we don't need to stop it.
    if (['STOPPED', 'EXITED', 'KILLED'].includes(curProcess.state)) {
      log.warn('', 'Process is already stopped; nothing to do.');
      return;
    }

    // Is this still needed?
    if (curProcess.state === 'STOPPING') {
      // Note: We sometimes get this unexpectedly.
      log.warn('', 'Process did not gracefully shut-down after last restart attempt. Last process state was:', curProcess.state);
      // lastProcess.handle.kill();
      await pWaitFor(() => ['STOPPED', 'EXITED', 'KILLED'].includes(curProcess.state));
      return;
    }

    log.info('', 'Restarting process.');
    log.silly('', `Sending signal ${log.chalk.yellow.bold(signal)} to process.`);

    curProcess.state = 'STOPPING';
    curProcess.handle.kill(signal);

    // Schedule the current process to be killed after the grace period.
    killAfterGracePeriod(curProcess);

    await pWaitFor(() => ['STOPPED', 'EXITED', 'KILLED'].includes(curProcess.state));
  }


  function killAfterGracePeriod(pd: ProcessDescriptor): void {
    // Asynchronously wait for the grace period duration, then kill the process.
    sleep(processShutdownGracePeriod || 0).then(() => { // tslint:disable-line no-floating-promises
      if (!['STOPPED', 'EXITED', 'KILLED'].includes(pd.state)) {
        pd.handle.kill();
        log.warn('', 'Process did not exit within the grace period and was forcefully terminated.');
        log.verbose('', `Its state was "${pd.state}".`);
      }
    });
  }


  /**
   * Closes all file watchers and waits for the current process to close. An
   * optional signal may be provided which will be sent to the process.
   */
  async function shutdown(signal: NodeJS.Signals = 'SIGINT') {
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


  return {
    start: startProcess,
    stop: shutdown
  };
}
