import {Arguments} from 'yargs';


/**
 * Parsed command-line arguments we accept.
 */
export interface SentinelleArguments extends Arguments {
  /**
   * Entrypoint to the script/application to run.
   */
  entrypoint: string;

  /**
   * (Optional) Binary to exec.
   *
   * Default: node
   */
  bin?: string;

  /**
   * (Optional) Directories to watch.
   *
   * Default: Directory of entry file.
   */
  watch?: Array<string>;

  /**
   * POSIX signal to send to the process when we need it to shut-down.
   *
   * Default: SIGINT
   */
  kill?: NodeJS.Signals;

  /**
   * Suppress all logging except errors and warnings.
   *
   * Default: false
   */
  quiet?: boolean;
}


/**
 * Possible options for stdio configuration that we accept.
 */
export type StdioOption = 'pipe' | 'ignore' | 'inherit';


/**
 * Possible states a process may be in.
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
 * Possible states a process Node debugger may be in.
 */
export type DebuggerState =
  // Default state, Node debugger not in use.
  'DISABLED' |
  // Process is listening for debuggers to attach.
  'LISTENING' |
  // Process has a debugger attached.
  'ATTACHED' |
  // Process has exited but an attached debugger is keeping it alive.
  'HANGING';


/**
 * Possible reasons why Sentinelle may have forcefully killed a process.
 */
export type KillReason =
  // Process was killed because the exit grace period expired.
  'GRACE_PERIOD_EXPIRED' |
  // Process was killed because a file change triggered a restart while the
  // debugger had paused execution.
  'PAUSED_DEBUGGER' |
  // Process was killed due to a hanging debugger instance keeping it alive.
  'HANGING_DEBUGGER';
