import {spawn, StdioOptions} from 'child_process';
import pWaitFor from 'p-wait-for';
import log from 'lib/log';


export type KillReason = 'GRACE_PERIOD_EXPIRED' | 'HANGING_DEBUGGER';


/**
 * Possible states a managed process may be in.
 */
export type ProcessState =
  // Process was still running when a restart request was issued. We are still
  // waiting for it to shut-down.
  'STOPPING' |
  // Process was still running when a restart request was issued. It then shut
  // down on its own within the allowed grace period.
  'STOPPED' |
  // Process was still running when a restart request was issued. It did not
  // shut-down within the allowed grace period and had to be killed.
  'KILLED' |
  // Process exited on its own before a restart request was issued.
  'EXITED' |
  // Process was started successfully.
  'STARTED' |
  // Process is starting.
  'STARTING';


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
  stdio?: StdioOptions;
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
   * Kills the process after the indicated grace period.
   */
  killAfterGracePeriod(time: number, signal?: NodeJS.Signals): void;

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
export default function ProcessDescriptorFactory({bin, args, stdio}: ProcessDescriptorOptions): ProcessDescriptor {
  /**
   * @private
   *
   * The managed process' current state.
   */
  let state: ProcessState;


  /**
   * @private
   *
   * Potential reason for why the process might have been forefully killed.
   */
  let killReason: KillReason;


  // ----- Private Methods -----------------------------------------------------

  /**
   * @private
   *
   * Sets the process' current state.
   */
  function setState(newState: ProcessState) {
    state = newState;
    log.silly('', `Set process state to ${log.chalk.bold(newState)}.`);
  }


  /**
   * @private
   *
   * Handle the "message" event.
   */
  function handleMessage(message: any) {
    log.silly('process', message);
  }


  /**
   * @private
   *
   * Handle the "error" event.
   */
  function handleError(err: Error) {
    if (err && err.stack) {
      log.error('', 'Child process error:', err.message);
      log.verbose('', err.stack.split('\n').slice(1).join('\n'));
    }
  }


  /**
   * @private
   *
   * If the stdio configuration was set to `pipe` for stderr, acts a listener
   * for stderr's `data` event.
   *
   * Q: Why?
   *
   * A: So, when our child process is run with the --inspect (or similar)
   *    flags, the process does not always organically close when the main
   *    thread dies because Node keeps the debugger alive. This issue should
   *    have been fixed by [1], but still persists in certain cases, even in
   *    Node 10.
   *
   * [1]: https://github.com/nodejs/node/issues/7742
   */
  function handleStderrData(chunk: any) {
    if (/Waiting for the debugger to disconnect/ig.test(Buffer.from(chunk).toString('utf8'))) {
      log.silly('', 'Detected a hanging debugger instance.');
      killReason = 'HANGING_DEBUGGER';
      // Rather than waiting for the grace period to expire, we should kill
      // the process immediately. We can safely assume that the process has
      // exited (as far as the user's code is concerned) because Node only
      // prints the above message when the code has finished executing _but_
      // a debugger is still attached.
      kill(); // tslint:disable-line no-floating-promises
    }
  }


  /**
   * @private
   *
   * Handle the (very complex) "close" event.
   */
  function handleClose(code: number, signal: string) {
    // ----- Exotic Unstable Exits ---------------------------------------------

    if (killReason === 'GRACE_PERIOD_EXPIRED') {
      // Process took longer than the grace period to shut-down.
      log.error('', log.chalk.red.bold('Process failed to shut-down in time and was killed.'));
      setState('KILLED');
      return;
    }

    if (killReason === 'HANGING_DEBUGGER') {
      // Process had a hanging debugger instnace attached and failed to
      // shut-down.
      log.error('', log.chalk.red.bold('Detected hanging debugger; process was killed.'));
      setState('KILLED');
      return;
    }


    // ----- Unstable Exits ----------------------------------------------------

    if (code !== 0 && signal === null) {
      if (state === 'STOPPING') {
        // Process was issued an interrupt signal and crashed within the grace
        // period.
        log.error('', log.chalk.red.bold('Process crashed while shutting-down.'));
        setState('STOPPED');
        return;
      }

      if (state === 'STARTED') {
        // Process crashed on its own without requiring an interrupt signal.
        log.error('', log.chalk.red.bold('Process crashed.'));
        setState('EXITED');
        return;
      }
    }


    // ----- Clean Exits -------------------------------------------------------

    if (code === 0 || code === null) {
      if (state === 'STOPPING') {
        // Process was issued an interrupt signal and closed cleanly within the
        // grace period.
        log.info('', log.chalk.bold('Process shut-down gracefully.'));
        setState('STOPPED');
        return;
      }

      if (state === 'STARTED') {
        // Process exited cleanly on its own without requiring an interrupt
        // signal.
        log.info('', log.chalk.bold('Process exited cleanly.'));
        setState('EXITED');
        return;
      }
    }

    throw new Error(`Unexpected code path in "close" handler. Exit code: ${code}; signal: ${signal}; State: ${state}`);
  }


  // ----- Public Methods ------------------------------------------------------

  /**
   * Returns the process' state.
   */
  function getState() {
    return state;
  }


  /**
   * Returns true if the process' state is STOPPED, KILLED, or EXITED.
   */
  function isClosed() {
    return ['STOPPED', 'EXITED', 'KILLED'].includes(state);
  }


  /**
   * Returns a Promise that resolves when the process' state becomes one of
   * STOPPED, KILLED, or EXITED.
   */
  async function awaitClosed() {
    return pWaitFor(() => ['STOPPED', 'EXITED', 'KILLED'].includes(state));
  }


  /**
   * Sets the process' state to STOPPING, issues a kill command, and returns a
   * promise that resolves when the process has exited.
   */
  async function kill(signal?: NodeJS.Signals) {
    setState('STOPPING');
    handle.kill(signal); // tslint:disable-line no-use-before-declare
    return awaitClosed();
  }


  /**
   * Kills the process after the indicated grace period.
   */
  function killAfterGracePeriod(time: any, signal: NodeJS.Signals = 'SIGTERM') {
    setTimeout(() => {
      if (!isClosed()) {
        log.warn('', 'Grace period expired, sending SIGTERM to process.');
        // Set killReason so `handleClose` knows what happened.
        killReason = 'GRACE_PERIOD_EXPIRED';
        kill(signal); // tslint:disable-line no-floating-promises
      }
    }, time || 0);
  }


  // ----- Init ----------------------------------------------------------------

  setState('STARTING');

  const handle = spawn(bin, args || [], {
    stdio,
    // Run the child process in detached mode, as this gives us more control
    // over how signals are passed from us to it.
    detached: true
  });

  // Set up event handlers.
  handle.on('message', handleMessage);
  handle.on('close', handleClose);
  handle.on('error', handleError);

  // Set up pipes (if stdio was `pipe`).
  if (handle.stdout) {
    handle.stdout.pipe(process.stdout);
  }

  if (handle.stderr) {
    handle.stderr.pipe(process.stderr);
    handle.stderr.on('data', handleStderrData);
  } else {
    log.verbose('', 'With current stdio configuration, Sentinelle will be unable to detect hanging debugger instances.');
  }

  setState('STARTED');


  return {
    getState,
    kill,
    killAfterGracePeriod,
    isClosed,
    awaitClosed
  };
}