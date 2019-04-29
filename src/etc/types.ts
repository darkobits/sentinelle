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
