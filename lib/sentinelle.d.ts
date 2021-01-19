/// <reference types="node" />
import { ProcessDescriptorOptions } from "./process-descriptor";
/**
 * Options that may be provided to `SentinelleFactory`.
 */
export interface SentinelleOptions {
    /**
     * Entry file for the application or script to manage.
     */
    entry: string;
    /**
     * (Optional) Additional arguments to pass to `entry`.
     */
    entryArgs?: Array<string>;
    /**
     * (Optional) Binary to use to run the application or script.
     *
     * Default: node
     */
    bin?: string;
    /**
     * (Optional) Extra files or directories to watch in addition to "entry".
     */
    watch?: Array<string>;
    /**
     * (Optional) Time to wait after issuing an interrupt signal to a process
     * before killing it.
     *
     * Default: 4 seconds
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
    stdio?: ProcessDescriptorOptions['stdio'];
}
/**
 * Object returned by SentinelleFactory.
 */
export interface Sentinelle {
    /**
     * Waits for any current managed process to become 'STOPPED', then starts a
     * new managed process and returns its process descriptor.
     */
    start(): Promise<void>;
    /**
     * Restarts the managed process.
     */
    restart(signal?: NodeJS.Signals): Promise<void>;
    /**
     * Closes all file watchers and waits for the current process to close. An
     * optional signal may be provided which will be sent to the process.
     */
    stop(signal?: NodeJS.Signals): Promise<void>;
}
/**
 * Creates a new Sentinelle that will watch a set of files and (re)start a
 * process when they change.
 *
 * TODO: Add our own SIGINT handler to gracefully shut-down the process before
 * exiting.
 */
export default function SentinelleFactory(options: SentinelleOptions): Sentinelle;
