import fs from 'fs';
import Emittery from 'emittery';
import uuid from 'uuid/v4';
import * as utils from 'lib/utils';


// ----- Test Data -------------------------------------------------------------

const ENTRY_PATH = `/${uuid()}`;
const ENTRY = `${ENTRY_PATH}/${uuid()}`;
const EXTRA_WATCHES = [`/${uuid()}`, `/${uuid()}.txt`, `/${uuid()}.js`];
const BIN = uuid();
const STDIO = uuid();
const EXTRA_ARGS = [uuid(), uuid(), uuid()];
const PROCESS_SHUTDOWN_SIGNAL = 'PROCESS_SHUTDOWN_SIGNAL';
const PROCESS_SHUTDOWN_GRACE_PERIOD = 999325;


describe('Sentinelle', () => {
  let sent: any;

  let chokidarWatchEmitter: Emittery;
  let chokidarWatchSpy: jest.Mock<Emittery, Array<any>>;
  let setTimeoutSpy: jest.SpyInstance<NodeJS.Timeout, [(...args: Array<any>) => void, number, ...Array<any>]>;
  let statSyncSpy: jest.Mock<fs.Stats, [fs.PathLike]>;
  let processDescriptorSpy: any;


  // ----- Mocks ---------------------------------------------------------------

  beforeEach(async () => {
    chokidarWatchEmitter = new Emittery();

    // @ts-ignore
    chokidarWatchEmitter.close = jest.fn((...args) => {
      // console.warn('[watcher.close] Called with:', args);
    });

    chokidarWatchSpy = jest.fn((...args) => {
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

    const Sentinelle = require('./sentinelle').default; // tslint:disable-line no-require-imports

    sent = Sentinelle({
      entry: ENTRY,
      bin: BIN,
      binArgs: EXTRA_ARGS,
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

    it('should create a ProcessDescriptor using the configured "bin", "entry", "binArgs", and "stdio" options', () => {
      expect(processDescriptorSpy.mock.calls[0]).toMatchObject([{
        bin: BIN,
        args: [...EXTRA_ARGS, ENTRY],
        stdio: STDIO
      }]);
    });

    it('should send a kill signal to the child process using the configured signal', async () => {
      await chokidarWatchEmitter.emit('change');

      // Assert that we called kill() with SIGINT.
      expect(processDescriptorSpy.kill.mock.calls[0][0]).toBe(PROCESS_SHUTDOWN_SIGNAL);
    });

    it('start a force-kill timeout using the configured grace period', async () => {
      await chokidarWatchEmitter.emit('change');

      // Assert that we started a timeout using the configured grace period.
      expect(processDescriptorSpy.killAfterGracePeriod).toHaveBeenCalledWith(PROCESS_SHUTDOWN_GRACE_PERIOD);
    });

    it('should start a new child process using the configured parameters', async () => {
      await chokidarWatchEmitter.emit('change');

      // Assert that we re-started our process.
      expect(processDescriptorSpy.mock.calls[1]).toMatchObject([{
        bin: BIN,
        args: [...EXTRA_ARGS, ENTRY],
        stdio: STDIO
      }]);
    });
  });

  describe('#stop', () => {
    const CUSTOM_SIGNAL = 'CUSTOM_SIGNAL';

    beforeEach(async () => {
      await sent.start();
      await sent.stop(CUSTOM_SIGNAL);
    });

    it('should close file watchers', () => {
      // @ts-ignore
      expect(chokidarWatchEmitter.close).toHaveBeenCalled();
    });

    it('should close the managed process', () => {
      expect(processDescriptorSpy.kill).toHaveBeenCalledWith(CUSTOM_SIGNAL);
    });
  });

  // TODO: Actually test for something here.
  // describe('on watcher errors', () => {
  //   it('should log an error event?', async () => {
  //     const err = new Error(uuid());
  //     await chokidarWatchEmitter.emit('error', err);
  //   });
  // });

  afterEach(() => {
    chokidarWatchEmitter.clearListeners();

    jest.unmock('chokidar');
    jest.unmock('lib/utils');

    statSyncSpy.mockRestore();
    setTimeoutSpy.mockRestore();

    jest.resetModuleRegistry();
  });
});
