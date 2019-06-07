import fs from 'fs';
import os from 'os';
import childProcess from 'child_process';
import uuid from 'uuid/v4';

import {
  isNumerical,
  parseTime,
  ensureArray,
  randomArrayElement
} from './utils';


describe('isNumerical', () => {
  describe('when provided a string without digits', () => {
    it('should return `false`', () => {
      expect(isNumerical('f2f394431')).toBe(false);
    });
  });

  describe('when provided a string with only digits', () => {
    it('should return `true`', () => {
      expect(isNumerical('1613423')).toBe(true);
    });
  });
});


describe('parseTime', () => {
  describe('when provided a number', () => {
    it('should return the number as-is', () => {
      expect(parseTime(42)).toBe(42);
    });
  });

  describe('when provided a numerical string', () => {
    it('should return a number', () => {
      expect(parseTime('9000')).toBe(9000);
    });
  });

  describe('when provided a parse-able string', () => {
    it('should return a number', () => {
      expect(parseTime('5m')).toBe(300000);
    });
  });

  describe('when provided an invalid string', () => {
    it('should return `undefined`', () => {
      expect(parseTime('foo')).toBe(undefined);
      expect(parseTime(undefined)).toBe(undefined);
    });
  });
});


describe('ensureBin', () => {
  let osPlatformSpy: jest.SpyInstance<NodeJS.Platform, []>;
  let execSyncSpy: jest.SpyInstance<Buffer, [string, (childProcess.ExecSyncOptions | undefined)?]>;
  let ensureBin: Function;

  beforeEach(() => {
    jest.resetAllMocks();
    osPlatformSpy = jest.spyOn(os, 'platform');
    execSyncSpy = jest.spyOn(childProcess, 'execSync');
    ensureBin = require('./utils').ensureBin; // tslint:disable-line no-require-imports
  });

  describe('on Windows platforms', () => {
    beforeEach(() => {
      osPlatformSpy.mockReturnValue('win32');
      // @ts-ignore
      execSyncSpy.mockReturnValue('');
    });

    it('should look for binaries using "where"', () => {
      const BIN_NAME = uuid();
      ensureBin(BIN_NAME);
      expect(osPlatformSpy).toHaveBeenCalled();
      expect(execSyncSpy.mock.calls[0][0].includes('where')).toBe(true);
      expect(execSyncSpy.mock.calls[0][0].includes(BIN_NAME)).toBe(true);
    });
  });

  describe('on non-Windows platforms', () => {
    beforeEach(() => {
      osPlatformSpy.mockReturnValue('darwin');
      // @ts-ignore
      execSyncSpy.mockReturnValue('');
    });

    it('should look for binaries using "which"', () => {
      const BIN_NAME = uuid();
      ensureBin(BIN_NAME);
      expect(osPlatformSpy).toHaveBeenCalled();
      expect(execSyncSpy.mock.calls[0][0].includes('which')).toBe(true);
      expect(execSyncSpy.mock.calls[0][0].includes(BIN_NAME)).toBe(true);
    });
  });

  describe('when the binary is not found on the system', () => {
    beforeEach(() => {
      osPlatformSpy.mockReturnValue('darwin');
      // @ts-ignore
      execSyncSpy.mockImplementation(() => {
        throw new Error('Command failed');
      });
    });

    it('should throw a custom error', () => {
      const BIN_NAME = uuid();

      expect(() => {
        ensureBin(BIN_NAME);
      }).toThrow(`The binary "${BIN_NAME}" was not found on your system.`);

      expect(execSyncSpy.mock.calls[0][0].includes(BIN_NAME)).toBe(true);
    });
  });

  describe('when other errors occur', () => {
    const MESSAGE = uuid();

    beforeEach(() => {
      osPlatformSpy.mockReturnValue('darwin');
      // @ts-ignore
      execSyncSpy.mockImplementation(() => {
        throw new Error(MESSAGE);
      });
    });

    it('should throw the error', () => {
      const BIN_NAME = uuid();

      expect(() => {
        ensureBin(BIN_NAME);
      }).toThrow(MESSAGE);

      expect(execSyncSpy.mock.calls[0][0].includes(BIN_NAME)).toBe(true);
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });
});


describe('ensureFile', () => {
  let accessSyncSpy: jest.SpyInstance<void, [fs.PathLike, (number | undefined)?]>;
  let ensureFile: Function;

  beforeEach(() => {
    jest.resetAllMocks();
    accessSyncSpy = jest.spyOn(fs, 'accessSync');
    ensureFile = require('./utils').ensureFile; // tslint:disable-line no-require-imports
  });

  describe('when the file exists and is readable', () => {
    beforeEach(() => {
      accessSyncSpy.mockReturnValue();
    });

    it('should return the absolute path to the file', () => {
      const FILE = `/${uuid()}`;
      const result = ensureFile(FILE);
      expect(result).toBe(FILE);
    });
  });

  describe('when the file does not exist', () => {
    beforeEach(() => {
      accessSyncSpy.mockImplementation(() => {
        const err = new Error();
        // @ts-ignore
        err.code = 'ENOENT';
        throw err;
      });
    });

    it('should throw an error', () => {
      expect(() => {
        ensureFile('');
      }).toThrow('could not be found');
    });
  });

  describe('when the file exists but can not be read', () => {
    beforeEach(() => {
      accessSyncSpy.mockImplementation(() => {
        const err = new Error();
        // @ts-ignore
        err.code = 'EACCES';
        throw err;
      });
    });

    it('should throw an error', () => {
      expect(() => {
        ensureFile('');
      }).toThrow('could not be read');
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });
});


describe('ensureArray', () => {
  describe('when provided an array', () => {
    it('should return the array as-is', () => {
      const arr = [uuid()];
      expect(ensureArray(arr)).toBe(arr);
    });
  });

  describe('when provided a non-array', () => {
    it('should wrap the value in an array and return it', () => {
      const val = uuid();
      expect(ensureArray(val)).toEqual([val]);
    });
  });
});


describe('getPackageVersion', () => {
  const VERSION = uuid();

  let getPackageVersion: Function;

  beforeEach(() => {
    jest.resetModuleRegistry();

    jest.doMock('read-pkg-up', () => {
      return async () => {
        return {
          package: {
            version: VERSION
          }
        };
      };
    });

    getPackageVersion = require('./utils').getPackageVersion; // tslint:disable-line no-require-imports
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should return the "version" field from the local package.json', async () => {
    expect(await getPackageVersion()).toBe(VERSION);
  });
});


describe('randomArrayElement', () => {
  it('should return a value contained in the provided array', () => {
    const arr = [uuid(), uuid(), uuid()];
    expect(arr.includes(randomArrayElement(arr))).toBe(true);
  });
});
