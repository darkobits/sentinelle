import {ChildProcess, SpawnOptions} from 'child_process';
import {Arguments as Yarguments} from 'yargs';


/**
 * Parsed command-line arguemnts we accept.
 *
 * Note: "entry" and "extraArgs" are positional arguments, and are therefore
 * provided via the "_" field.
 */
export interface Arguments extends Yarguments {
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
}


/**
 * Options that may be provided to SentinelleFactory.
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
   * Default: SIGUSR2
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
 * Object containing a child process handle and a process state.
 */
export interface ProcessDescriptor {
  handle: ChildProcess;
  state: ProcessState;
}
