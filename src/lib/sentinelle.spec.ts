/* eslint-disable @typescript-eslint/no-var-requires */
import fs from 'fs';
import Emittery from 'emittery';
import {v4 as uuid} from 'uuid';
import * as utils from 'lib/utils';


// ----- Test Data -------------------------------------------------------------

const ENTRY_PATH = `/${uuid()}`;
const ENTRY = `${ENTRY_PATH}/__ENTRY__ __EXTRA_ARG_1__ __EXTRA_ARG_2__`;
const EXTRA_WATCHES = [`/${uuid()}`, `/${uuid()}.txt`, `/${uuid()}.js`];
const BIN = '__BIN__ __BIN_ARG_1__';
const STDIO = '__STDIO__';
const PROCESS_SHUTDOWN_SIGNAL = 'PROCESS_SHUTDOWN_SIGNAL';
const PROCESS_SHUTDOWN_GRACE_PERIOD = 999325;


describe('Sentinelle', () => {
  let sent: any;

  let chokidarWatchEmitter: Emittery;
  let chokidarWatchSpy: jest.Mock<Emittery, Array<any>>;
  let setTimeoutSpy: jest.SpyInstance<NodeJS.Timeout, [callback: (...args: Array<any>) => void, ms?: number | undefined, ...args: Array<any>]>;
  let statSyncSpy: jest.SpyInstance<fs.Stats, [fs.PathLike]>;
  let processDescriptorSpy: any;


  // ----- Mocks ---------------------------------------------------------------

  beforeEach(async () => {
    chokidarWatchEmitter = new Emittery();

    // @ts-expect-error
    chokidarWatchEmitter.close = jest.fn(() => {
      // console.warn('[watcher.close] Called with:', args);
    });

    chokidarWatchSpy = jest.fn(() => {
      // console.warn('[chokidar] Got args:', args);
      return chokidarWatchEmitter;
    });

    jest.doMock('chokidar', () => ({
      watch: chokidarWatchSpy
    }));

    setTimeoutSpy = jest.spyOn(global, 'setTimeout');

    jest.doMock('lib/utils', () => ({
      ensureBin: jest.fn((bin: string) => bin),
      ensureFile: jest.fn((file: string) => file),
      randomArrayElement: utils.randomArrayElement,
      parseTime: utils.parseTime,
      ensureArray: utils.ensureArray
    }));

    const oStatSync = fs.statSync;

    // @ts-expect-error
    statSyncSpy = jest.spyOn(fs, 'statSync').mockImplementation((arg: string) => {
      const isOurCall = [ENTRY_PATH, ENTRY, ...EXTRA_WATCHES].map(item => arg.includes(item)).includes(true);

      if (isOurCall) {
        return {
          isDirectory: jest.fn(() => {
            return !arg.includes('.');
          })
        };
      }

      return Reflect.apply(oStatSync, fs, [arg]);
    });

    jest.doMock('lib/process-descriptor', () => {
      const getState = jest.fn();
      const kill = jest.fn();
      const killAfterGracePeriod = jest.fn();
      const isClosed = jest.fn();
      const awaitClosed = jest.fn();

      processDescriptorSpy = jest.fn(() => {
        return {
          getState,
          kill,
          killAfterGracePeriod,
          isClosed,
          awaitClosed
        };
      });

      processDescriptorSpy.getState = getState;
      processDescriptorSpy.kill = kill;
      processDescriptorSpy.killAfterGracePeriod = killAfterGracePeriod;
      processDescriptorSpy.isClosed = isClosed;
      processDescriptorSpy.awaitClosed = awaitClosed;

      return processDescriptorSpy;
    });

    const Sentinelle = require('./sentinelle');

    sent = Sentinelle({
      bin: BIN,
      entry: ENTRY,
      watch: EXTRA_WATCHES,
      processShutdownGracePeriod: PROCESS_SHUTDOWN_GRACE_PERIOD,
      processShutdownSignal: PROCESS_SHUTDOWN_SIGNAL,
      stdio: STDIO
    });
  });

  describe('#start', () => {
    beforeEach(async () => {
      await sent.start();
    });

    it('should create watchers using the configured "entry" and "watch" options', () => {
      // Asserts correct behavior of "entry" and "watch" options.
      expect(chokidarWatchSpy.mock.calls[0][0]).toMatchObject([
        ENTRY_PATH,
        ...EXTRA_WATCHES
      ]);
    });

    it('should send a kill signal to the child process using the configured signal', async () => {
      await chokidarWatchEmitter.emit('change');

      // Assert that we called kill() with SIGINT.
      expect(processDescriptorSpy.kill.mock.calls[0][0]).toBe(PROCESS_SHUTDOWN_SIGNAL);
    });

    it('should start a new child process using the configured parameters', async () => {
      await chokidarWatchEmitter.emit('change');

      // Assert that we re-started our process.
      expect(processDescriptorSpy.mock.calls[1]).toMatchObject([{
        bin: '__BIN__',
        args: ['__BIN_ARG_1__', ...ENTRY.split(' ')],
        stdio: STDIO
      }]);
    });

    describe('when the "bin" option is used', () => {
      it('should create a ProcessDescriptor using the configured "bin", "entry", and "stdio" options', () => {
        expect(processDescriptorSpy.mock.calls[0]).toMatchObject([{
          bin: '__BIN__',
          args: ['__BIN_ARG_1__', ...ENTRY.split(' ')],
          stdio: STDIO
        }]);
      });
    });

    describe('when the "bin" option is not used', () => {
      beforeEach(async () => {
        const Sentinelle = require('./sentinelle');

        sent = Sentinelle({
          entry: ENTRY,
          watch: EXTRA_WATCHES,
          processShutdownGracePeriod: PROCESS_SHUTDOWN_GRACE_PERIOD,
          processShutdownSignal: PROCESS_SHUTDOWN_SIGNAL,
          stdio: STDIO
        });

        await sent.start();
      });

      it('should create a ProcessDescriptor using the configured "bin", "entry", and "stdio" options', () => {
        expect(processDescriptorSpy.mock.calls[0]).toMatchObject([{
          bin: '__BIN__',
          args: ['__BIN_ARG_1__', ...ENTRY.split(' ')],
          stdio: STDIO
        }]);
      });
    });
  });

  describe('#stop', () => {
    const CUSTOM_SIGNAL = 'CUSTOM_SIGNAL';

    beforeEach(async () => {
      await sent.start();
      await sent.stop(CUSTOM_SIGNAL);
    });

    it('should close file watchers', () => {
      // @ts-expect-error
      expect(chokidarWatchEmitter.close).toHaveBeenCalled();
    });

    it('should close the managed process', () => {
      expect(processDescriptorSpy.kill).toHaveBeenCalledWith(CUSTOM_SIGNAL);
    });
  });

  afterEach(() => {
    chokidarWatchEmitter.clearListeners();

    jest.unmock('chokidar');
    jest.unmock('lib/utils');

    statSyncSpy.mockRestore();
    setTimeoutSpy.mockRestore();

    jest.resetModules();
  });
});
