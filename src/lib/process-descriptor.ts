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
export default function ProcessDescriptorFactory({bin, args, stdio, shutdownGracePeriod}: ProcessDescriptorOptions): ProcessDescriptor {
  /**
   * @private
   *
   * Child process/promise returned by Execa.
   */
  let _process: execa.ExecaChildProcess;


  /**
   * @private
   *
   * The managed process' current state.
   */
  let _state: ProcessState;


  /**
   * @private
   *
   * Tracks the state of Node debugger instances that may be attached to the
   * process.
   */
  let _debuggerState: DebuggerState = 'DISABLED';


  /**
   * @private
   *
   * Potential reason for why the process might have been forefully killed.
   */
  let _killReason: KillReason;


  /**
   * @private
   *
   * Number of milliseconds to wait before forcefully killing a process.
   */
  const _shutdownGracePeriod = shutdownGracePeriod || 4000;


  // ----- Private Methods -----------------------------------------------------

  /**
   * @private
   *
   * Sets the process' current state.
   */
  function _setState(newState: ProcessState) {
    if (_state !== newState) {
      _state = newState;
      log.silly(`Set process state to ${log.chalk.bold(newState)}.`);
    }
  }


  /**
   * @private
   *
   * Handle the "message" event.
   */
  function _handleMessage(message: any) {
    log.silly('process', message);
  }


  /**
   * @private
   *
   * Handle the "error" event.
   */
  function _handleError<E extends Error & execa.ExecaError & {code: string}>(err: E) {
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

    if (err && err.stack) {
      log.error(`Child process error: ${err.message}`);
      log.verbose(err.stack.split('\n').slice(1).join('\n'));
    }

    if (err.exitCodeName === 'ENOENT' || err.code === 'ENOENT') {
      log.error('hint', log.chalk.bold('Did you remember to set a shebang in your entrypoint?'));
    }

    if (err.exitCodeName === 'EACCES' || err.code === 'EACCES') {
      log.error('hint', log.chalk.bold('Did you remember to set the executable flag on your entrypoint?'));
    }
  }


  /**
   * @private
   *
   * If the stdio configuration was set to `pipe` for stderr, acts a listener
   * for stderr's `data` event. This allows us to track the state of Node
   * debuggers.
   */
  function _handleStderrData(chunk: any) {
    const data = Buffer.from(chunk).toString('utf8');

    if (/Debugger listening on/.test(data)) {
      _debuggerState = 'LISTENING';
      log.verbose(`Set debugger state to ${log.chalk.bold('LISTENING')}.`);
    }

    if (/Debugger attached/.test(data)) {
      _debuggerState = 'ATTACHED';
      log.verbose(`Set debugger state to ${log.chalk.bold('ATTACHED')}.`);
    }

    // This scenario tends to arise when a process exits on its own (re: was not
    // shut-down) and had a debugger instance attached. Whether or not the
    // debugger was/is paused, Node will keep the process alive and issue the
    // below message. When we see this message, we know we can safely kill the
    // process immediately.
    if (/Waiting for the debugger to disconnect/ig.test(data)) {
      _debuggerState = 'HANGING';
      _killReason = 'HANGING_DEBUGGER';
      // Rather than waiting for the grace period to expire, we should kill
      // the process immediately. We can safely assume that the process has
      // exited (as far as the user's code is concerned) because Node only
      // prints the above message when the code has finished executing _but_
      // a debugger is still attached.
      kill('SIGKILL'); // tslint:disable-line no-floating-promises
    }
  }


  /**
   * @private
   *
   * Handle the (very complex) "close" event.
   */
  function _handleClose(code: number, signal: string) {
    // ----- Exotic Ungraceful Exits -------------------------------------------

    if (_killReason === 'GRACE_PERIOD_EXPIRED') {
      // Process took longer than the grace period to shut-down.
      log.error(log.chalk.red.bold('Process failed to shut-down in time and was killed.'));
      _setState('KILLED');
      return;
    }

    if (signal === 'SIGKILL') {
      // Process closed as a result of SIGKILL.
      log.error(log.chalk.red.bold('Process was killed.'));
      _setState('KILLED');
      return;
    }

    if (_killReason === 'PAUSED_DEBUGGER') {
      // Process was killed because a file change triggered a restart while the
      // debugger had paused execution.
      log.info(log.chalk.red.dim.bold('Detected paused debugger; process was killed.'));
      _setState('KILLED');
      return;
    }

    if (_killReason === 'HANGING_DEBUGGER') {
      // Process had a hanging debugger instnace attached and failed to
      // shut-down.
      log.info(log.chalk.red.dim.bold('Detected hanging debugger; process was killed.'));
      _setState('KILLED');
      return;
    }


    // ----- Ungraceful Exits --------------------------------------------------

    if (code !== 0 && signal === null) {
      if (_state === 'STOPPING') {
        // Process was issued an interrupt signal and crashed within the grace
        // period.
        log.error(log.chalk.red.bold('Process crashed while shutting-down.'));
        _setState('STOPPED');
        return;
      }

      if (_state === 'STARTED') {
        // Process crashed on its own without requiring an interrupt signal.
        log.error(log.chalk.red.bold(`Process crashed. ${log.chalk.dim(`(Code: ${code})`)}`));

        _setState('EXITED');
        return;
      }
    }


    // ----- Graceful Exits ----------------------------------------------------

    if (code === 0 || code === null) {
      if (_state === 'STOPPING') {
        // Process was issued an interrupt signal and closed cleanly within the
        // grace period.
        log.info(log.chalk.bold('Process shut-down gracefully.'));
        _setState('STOPPED');
        return;
      }

      if (_state === 'STARTED') {
        // Process exited cleanly on its own without requiring an interrupt
        // signal.
        log.info(log.chalk.bold('Process exited cleanly.'));
        _setState('EXITED');
        return;
      }
    }

    throw new Error(`Unexpected code path in "close" handler. Exit code: ${code}; signal: ${signal}; State: ${_state}`);
  }


  /**
   * @private
   *
   * Kills the process after the indicated grace period.
   */
  function _killAfterGracePeriod(signal: NodeJS.Signals) {
    setTimeout(() => {
      // Process has not exited after the grace period and a Node debugger is
      // attached. It is likely that the process did not exit because the
      // debugger is paused. In this case, we need to send a SIGKILL to the
      // process to force it to exit.
      if (!isClosed() && _debuggerState === 'ATTACHED') {
        _killReason = 'PAUSED_DEBUGGER';
        kill('SIGKILL'); // tslint:disable-line no-floating-promises
        return;
      }

      // Process has not exited after the grace period
      if (!isClosed()) {
        // Set killReason so `handleClose` knows what happened.
        _killReason = 'GRACE_PERIOD_EXPIRED';
        kill(signal); // tslint:disable-line no-floating-promises
        return;
      }
    }, _shutdownGracePeriod);
  }


  // ----- Public Methods ------------------------------------------------------

  /**
   * Returns the process' state.
   */
  function getState() {
    return _state;
  }


  /**
   * Returns true if the process' state is STOPPED, KILLED, or EXITED.
   */
  function isClosed() {
    return ['STOPPED', 'EXITED', 'KILLED'].includes(_state);
  }


  /**
   * Returns a Promise that resolves when the process' state becomes one of
   * STOPPED, KILLED, or EXITED.
   */
  async function awaitClosed() {
    return pWaitFor(isClosed);
  }


  /**
   * Sets the process' state to STOPPING, issues a kill command, and returns a
   * promise that resolves when the process has exited.
   */
  async function kill(signal?: NodeJS.Signals) {
    _setState('STOPPING');
    _process.kill(signal); // tslint:disable-line no-use-before-declare
    _killAfterGracePeriod('SIGKILL');
    return awaitClosed();
  }


  // ----- Init ----------------------------------------------------------------

  _setState('STARTING');

  // Run the child process in detached mode, as this gives us more control over
  // how signals are passed from us to it.
  _process = execa(bin, args, {stdio, detached: true});

  // Prevents unhandled rejection warnings and lets us hook into process crash
  // information that we don't get with the error handler above.
  _process.catch(_handleError);

  // Set up event handlers.
  _process.on('message', _handleMessage);
  _process.on('close', _handleClose);
  _process.on('error', _handleError);

  // Set up pipes as needed.
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
    log.verbose('With current stdio configuration, Sentinelle will be unable to detect hanging/paused Node debugger instances.');
  }

  _setState('STARTED');


  return {
    getState,
    kill,
    isClosed,
    awaitClosed
  };
}
