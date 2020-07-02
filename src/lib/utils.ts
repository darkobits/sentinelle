import {execSync} from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

import ms from 'ms';
import readPkgUp from 'read-pkg-up';


/**
 * Returns true if the provided string _only_ contains digits.
 */
export function isNumerical(value: any) {
  return !/\D/g.test(String(value));
}


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
export function parseTime(value?: string | number) {
  // Covers `null`, `undefined`, `false`.
  if (!value && !isNumerical(value)) {
    return;
  }

  if (typeof value === 'string') {
    if (isNumerical(value)) {
      return Number.parseInt(value, 10);
    }

    // The type definitions for `ms` do not indicate that it returns `undefined`
    // on invaid input, so we have to explicitly type it here.
    return ms(value) as number | undefined;
  }

  return value;
}


/**
 * Provided the name of a binary, returns the path to that binary if it is
 * present on the system and locatable via the user's shell.
 */
export function ensureBin(name: string) {
  const binFinder = os.platform() === 'win32' ? 'where' : 'which';

  try {
    return execSync(`${binFinder} ${name}`, {encoding: 'utf8'}).trim();
  } catch (err) {
    if (err?.message && err.message.toLowerCase().includes('command failed')) {
      throw new Error(`The binary "${name}" was not found on your system.`);
    }

    throw err;
  }
}


/**
 * Provided the path to/name of a file, ensures the file exists and is readable.
 */
export function ensureFile(name: string) {
  const absPath = path.resolve(name);

  try {
    fs.accessSync(absPath, fs.constants.R_OK);
    return absPath;
  } catch (err) {
    if (err.code === 'ENOENT') {
      throw new Error(`The file "${absPath}" could not be found.`);
    }

    if (err.code === 'EACCES') {
      throw new Error(`The file "${absPath}" could not be read; permission denied.`);
    }

    throw err;
  }
}


/**
 * If the provided value is an array, returns it. Otherwise, wraps the value in
 * an array and returns it.
 */
export function ensureArray<T>(value: T | Array<T> | null | undefined): Array<T> {
  if (Array.isArray(value)) {
    return value;
  }

  if (value === null || value === undefined) {
    return [];
  }

  return [value];
}


/**
 * Returns a Promise that resolves with the current "version" from our
 * package.json.
 */
export async function getPackageVersion() {
  const pkgInfo = await readPkgUp({cwd: __dirname});

  if (!pkgInfo) {
    throw new Error('Unable to locate a package.json for Senintlle.');
  }


  return pkgInfo.packageJson.version;
}


/**
 * Returns a random element from the provided array.
 */
export function randomArrayElement<T = any>(xs: Array<T>): T {
  return xs[Math.floor(Math.random() * xs.length)];
}
