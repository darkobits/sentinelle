/// <reference types="node" />
import { ProcessState, StdioOption } from "../etc/types";
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
export default function ProcessDescriptorFactory({ bin, args, stdio, shutdownGracePeriod }: ProcessDescriptorOptions): ProcessDescriptor;
