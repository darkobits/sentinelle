/**
 * Default POSIX signal to send to a process when we need it to shut-down.
 */
export declare const DEFAULT_KILL_SIGNAL = "SIGINT";
/**
 * Default amount of time to wait for a process to exit before forcefully
 * killing it.
 */
export declare const DEFAULT_SHUTDOWN_GRACE_PERIOD = 4000;
