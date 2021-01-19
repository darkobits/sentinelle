/**
 * Returns true if the provided string _only_ contains digits.
 */
export declare function isNumerical(value: any): boolean;
/**
 * Provided a string or number representing an interval of time, returns the
 * number of milliseconds in that interval.
 *
 * Example:
 *
 * '5m'     //=> 300000
 * '300000' //=> 300000
 * 300000   //=> 300000
 * 'foo'    //=> undefined
 */
export declare function parseTime(value?: string | number): number | undefined;
/**
 * Provided the name of a binary, returns the path to that binary if it is
 * present on the system and locatable via the user's shell.
 */
export declare function ensureBin(name: string): string;
/**
 * Provided the path to/name of a file, ensures the file exists and is readable.
 */
export declare function ensureFile(name: string): string;
/**
 * If the provided value is an array, returns it. Otherwise, wraps the value in
 * an array and returns it.
 */
export declare function ensureArray<T>(value: T | Array<T> | null | undefined): Array<T>;
/**
 * Returns a Promise that resolves with the current "version" from our
 * package.json.
 */
export declare function getPackageVersion(): Promise<string>;
/**
 * Returns a random element from the provided array.
 */
export declare function randomArrayElement<T = any>(xs: Array<T>): T;
