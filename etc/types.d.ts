/// <reference types="node" />
import { Arguments } from 'yargs';
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
export declare type StdioOption = 'pipe' | 'ignore' | 'inherit';
/**
 * Possible states a process may be in.
 */
export declare type ProcessState = 'STOPPING' | 'STOPPED' | 'KILLED' | 'EXITED' | 'STARTED' | 'STARTING';
/**
 * Possible states a process Node debugger may be in.
 */
export declare type DebuggerState = 'DISABLED' | 'LISTENING' | 'ATTACHED' | 'HANGING';
/**
 * Possible reasons why Sentinelle may have forcefully killed a process.
 */
export declare type KillReason = 'GRACE_PERIOD_EXPIRED' | 'PAUSED_DEBUGGER' | 'HANGING_DEBUGGER';
