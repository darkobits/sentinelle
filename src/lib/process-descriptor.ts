import fs from 'fs';
import os from 'os';

import execa from 'execa';
import pWaitFor from 'p-wait-for';
import log from 'lib/log';

import {
  DebuggerState,
  KillReason,
  ProcessState,
  StdioOption
} from 'etc/types';


/**
 * Options object accepted by `ProcessDescriptorFactory`.
 */
export interface ProcessDescriptorOptions {
  /**
   * Name of the binary to run.
   */
  bin: string;

  /**
   * Array of additional arguments to pass to the binary.
   */
  args?: Array<string>;

  /**
   * Output configuration for the spawned process.
   */
  stdio?: StdioOption | Array<StdioOption>;

  /**
   * Number of milliseconds to wait before forcefully killing a process.
   */
  shutdownGracePeriod: number;
}


/**
 * Shape of objects returned by ProcessDescriptorFactory.
 */
export interface ProcessDescriptor {
  /**
   * Returns the process' state.
   */
  getState(): ProcessState;

  /**
   * Issues a kill command to the process, sets its state to STOPPING, and
   * returns a promise that resolves when the process has exited.
   */
  kill(signal?: NodeJS.Signals): Promise<void>;

  /**
   * Returns true if the process' state is STOPPED, KILLED, or EXITED.
   */
  isClosed(): boolean;

  /**
   * Returns a Promise that resolves when the process' state becomes one of
   * STOPPED, KILLED, or EXITED.
   */
  awaitClosed(): Promise<void>;
}


/**
 * Returns a new process descriptor representing a managed process and its
 * state.
 */
export default function ProcessDescriptorFactory(opts: ProcessDescriptorOptions): ProcessDescriptor {
  const processDescriptor: Partial<ProcessDescriptor> = {};


  /**
   * @private
   *
   * Child process/promise returned by Execa.
   */
  // eslint-disable-next-line prefer-const
  let childProcess: execa.ExecaChildProcess;


  /**
   * @private
   *
   * The managed process' current state.
   */
  let state: ProcessState;


  /**
   * @private
   *
   * Tracks the state of Node debugger instances that may be attached to the
   * process.
   */
  let debuggerState: DebuggerState = 'DISABLED';


  /**
   * @private
   *
   * Potential reason for why the process might have been forcefully killed.
   */
  let killReason: KillReason;


  /**
   * @private
   *
   * Number of milliseconds to wait before forcefully killing a process.
   */
  const shutdownGracePeriod = opts.shutdownGracePeriod ?? 4000;


  // ----- Private Methods -----------------------------------------------------

  /**
   * @private
   *
   * Sets the process' current state.
   */
  const setState = (newState: ProcessState) => {
    if (state !== newState) {
      state = newState;
      log.silly(`Set process state to ${log.chalk.bold(newState)}.`);
    }
  };


  /**
   * @private
   *
   * Handle the "message" event.
   */
  const handleMessage = (message: any) => {
    log.silly('process', message);
  };


  /**
   * @private
   *
   * Handle the "error" event.
   */
  const handleError = <E extends Error & execa.ExecaError & {code: string}>(err: E) => {
    if (err.exitCode === 2 && err.failed) {
      const firstLine = fs.readFileSync(err.command, {encoding: 'utf8'}).split(os.EOL)[0];

      if (!firstLine.startsWith('#!')) {
        log.error('hint', log.chalk.bold('Did you remember to set a shebang in your entrypoint?'));
        return;
      }
    }

    // Error messages from execa that we can safely ignore as they are reported
    // by us.
    const ignoreMessages = [
      'Command failed',
      'Command was killed with',
      // Issue appeared in execa 2.0.0 and seems to only occur when detached is
      // true.
      'Cannot destructure property `error`'
    ];

    if (ignoreMessages.some(m => String(err.message).includes(m))) {
      return;
    }

    if (err?.stack) {
      log.error(`Child process error: ${err.message}`);
      log.verbose(err.stack.split('\n').slice(1).join('\n'));
    }

    if (err.code === 'EACCES') {
      log.error('hint', log.chalk.bold('Did you remember to set the executable flag on your entrypoint?'));
    }
  };


  /**
   * @private
   *
   * If the stdio configuration was set to `pipe` for stderr, acts a listener
   * for stderr's `data` event. This allows us to track the state of Node
   * debuggers.
   */
  const handleStderrData = (chunk: any) => {
    const data = Buffer.from(chunk).toString('utf8');

    if (data.includes('Debugger listening on')) {
      debuggerState = 'LISTENING';
      log.verbose(`Set debugger state to ${log.chalk.bold('LISTENING')}.`);
    }

    if (data.includes('Debugger attached')) {
      debuggerState = 'ATTACHED';
      log.verbose(`Set debugger state to ${log.chalk.bold('ATTACHED')}.`);
    }

    // This scenario tends to arise when a process exits on its own (re: was not
    // shut-down) and had a debugger instance attached. Whether or not the
    // debugger was/is paused, Node will keep the process alive and issue the
    // below message. When we see this message, we know we can safely kill the
    // process immediately.
    if (/waiting for the debugger to disconnect/gi.test(data)) {
      debuggerState = 'HANGING';
      killReason = 'HANGING_DEBUGGER';
      // Rather than waiting for the grace period to expire, we should kill
      // the process immediately. We can safely assume that the process has
      // exited (as far as the user's code is concerned) because Node only
      // prints the above message when the code has finished executing _but_
      // a debugger is still attached.
      if (typeof processDescriptor.kill === 'function') {
        void processDescriptor.kill('SIGKILL');
      }
    }
  };


  /**
   * @private
   *
   * Handle the (very complex) "close" event.
   */
  const handleClose = (code: number, signal: string) => {
    // ----- Exotic Ungraceful Exits -------------------------------------------

    if (killReason === 'GRACE_PERIOD_EXPIRED') {
      // Process took longer than the grace period to shut-down.
      log.error(log.chalk.red.bold('Process failed to shut-down in time and was killed.'));
      setState('KILLED');
      return;
    }

    if (signal === 'SIGKILL') {
      // Process closed as a result of SIGKILL.
      log.error(log.chalk.red.bold('Process was killed.'));
      setState('KILLED');
      return;
    }

    if (killReason === 'PAUSED_DEBUGGER') {
      // Process was killed because a file change triggered a restart while the
      // debugger had paused execution.
      log.info(log.chalk.red.dim.bold('Detected paused debugger; process was killed.'));
      setState('KILLED');
      return;
    }

    if (killReason === 'HANGING_DEBUGGER') {
      // Process had a hanging debugger instnace attached and failed to
      // shut-down.
      log.info(log.chalk.red.dim.bold('Detected hanging debugger; process was killed.'));
      setState('KILLED');
      return;
    }


    // ----- Ungraceful Exits --------------------------------------------------

    if (code !== 0 && signal === null) {
      if (state === 'STOPPING') {
        // Process was issued an interrupt signal and crashed within the grace
        // period.
        log.error(log.chalk.red.bold('Process crashed while shutting-down.'));
        setState('STOPPED');
        return;
      }

      if (state === 'STARTED') {
        // Process crashed on its own without requiring an interrupt signal.
        log.error(log.chalk.red.bold(`Process crashed. ${log.chalk.dim(`(Code: ${code})`)}`));

        setState('EXITED');
        return;
      }
    }


    // ----- Graceful Exits ----------------------------------------------------

    if (code === 0 || code === null) {
      if (state === 'STOPPING') {
        // Process was issued an interrupt signal and closed cleanly within the
        // grace period.
        log.info(log.chalk.bold('Process shut-down gracefully.'));
        setState('STOPPED');
        return;
      }

      if (state === 'STARTED') {
        // Process exited cleanly on its own without requiring an interrupt
        // signal.
        log.info(log.chalk.bold('Process exited cleanly.'));
        setState('EXITED');
        return;
      }
    }

    throw new Error(`Unexpected code path in "close" handler. Exit code: ${code}; signal: ${signal}; State: ${state}`);
  };


  /**
   * @private
   *
   * Kills the process after the indicated grace period.
   */
  const killAfterGracePeriod = (signal: NodeJS.Signals) => {
    setTimeout(() => {
      // Process has not exited after the grace period and a Node debugger is
      // attached. It is likely that the process did not exit because the
      // debugger is paused. In this case, we need to send a SIGKILL to the
      // process to force it to exit.
      if (processDescriptor.isClosed && processDescriptor.kill && !processDescriptor.isClosed() && debuggerState === 'ATTACHED') {
        killReason = 'PAUSED_DEBUGGER';
        void processDescriptor.kill('SIGKILL');
        return;
      }

      // Process has not exited after the grace period
      if (processDescriptor.isClosed && processDescriptor.kill && !processDescriptor.isClosed()) {
        // Set killReason so `handleClose` knows what happened.
        killReason = 'GRACE_PERIOD_EXPIRED';
        void processDescriptor.kill(signal);
        return;
      }
    }, shutdownGracePeriod);
  };


  // ----- Public Methods ------------------------------------------------------

  /**
   * Returns the process' state.
   */
  processDescriptor.getState = () => {
    return state;
  };


  /**
   * Returns true if the process' state is STOPPED, KILLED, or EXITED.
   */
  processDescriptor.isClosed = () => {
    return ['STOPPED', 'EXITED', 'KILLED'].includes(state);
  };


  /**
   * Returns a Promise that resolves when the process' state becomes one of
   * STOPPED, KILLED, or EXITED.
   */
  processDescriptor.awaitClosed = async () => {
    if (processDescriptor.isClosed) {
      return pWaitFor(processDescriptor.isClosed);
    }
  };


  /**
   * Sets the process' state to STOPPING, issues a kill command, and returns a
   * promise that resolves when the process has exited.
   */
  processDescriptor.kill = async (signal?: NodeJS.Signals) => {
    setState('STOPPING');
    childProcess.kill(signal);
    killAfterGracePeriod('SIGKILL');

    if (processDescriptor.awaitClosed) {
      return processDescriptor.awaitClosed();
    }
  };


  // ----- Init ----------------------------------------------------------------

  setState('STARTING');

  // Run the child process in detached mode, as this gives us more control over
  // how signals are passed from us to it.
  childProcess = execa(opts.bin, opts.args, { stdio: opts.stdio, detached: true });

  // Prevents unhandled rejection warnings and lets us hook into process crash
  // information that we don't get with the error handler above.
  childProcess.catch(handleError);

  // Set up event handlers.
  void childProcess.on('message', handleMessage);
  void childProcess.on('close', handleClose);
  void childProcess.on('error', handleError);

  // Set up pipes as needed.
  if (childProcess.stdin) {
    process.stdin.pipe(childProcess.stdin);
  }

  if (childProcess.stdout) {
    childProcess.stdout.pipe(process.stdout);
  }

  if (childProcess.stderr) {
    childProcess.stderr.pipe(process.stderr);
    childProcess.stderr.on('data', handleStderrData);
  } else if (opts.bin.endsWith('node')) {
    log.verbose('With current stdio configuration, Sentinelle will be unable to detect hanging/paused Node debugger instances.');
  }

  setState('STARTED');

  return processDescriptor as Required<ProcessDescriptor>;
}
