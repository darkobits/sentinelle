import fs from 'fs';
import childProcess from 'child_process';
import Emittery from 'emittery';
import uuid from 'uuid/v4';


describe('Sentinelle', () => {
  let sent: any;

  // ----- Test Data -----------------------------------------------------------

  const ENTRY_PATH = `/${uuid()}`;
  const ENTRY = `${ENTRY_PATH}/${uuid()}`;
  const EXTRA_WATCHES = [`/${uuid()}`, `/${uuid()}.txt`, `/${uuid()}.js`];
  const BIN = uuid();
  const STDIO = uuid();
  const EXTRA_ARGS = [uuid(), uuid(), uuid()];
  const PROCESS_SHUTDOWN_SIGNAL = 'PROCESS_SHUTDOWN_SIGNAL';
  const PROCESS_SHUTDOWN_GRACE_PERIOD = 999325;

  let chokidarWatchEmitter: Emittery;
  let childProcessEmitter: Emittery;
  let chokidarWatchSpy: jest.Mock<Emittery, Array<any>>;
  let spawnSpy: jest.Mock<childProcess.ChildProcess, [string, Array<string>, childProcess.SpawnOptions]>;
  let setTimeoutSpy: jest.SpyInstance<NodeJS.Timeout, [(...args: Array<any>) => void, number, ...Array<any>]>;
  let statSyncSpy: jest.Mock<fs.Stats, [fs.PathLike]>;


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

    childProcessEmitter = new Emittery();

    // @ts-ignore
    childProcessEmitter.kill = jest.fn(async () => {
      // console.warn('[kill] Called.');
      // This sets the process state to "KILLED", but its the only path we can
      // take without throwing an error, because Emittery only allows us to pass a
      // single argument to emit();
      return childProcessEmitter.emit('close', null); // tslint:disable-line no-null-keyword
    });

    // @ts-ignore
    spawnSpy = jest.spyOn(childProcess, 'spawn').mockImplementation((...args) => {
      // console.warn('[spawn] Got args:', args);
      return childProcessEmitter;
    });

    setTimeoutSpy = jest.spyOn(global, 'setTimeout');

    jest.doMock('lib/utils', () => ({
      ensureBin: jest.fn((bin: string) => bin),
      ensureFile: jest.fn((file: string) => file),
      randomArrayElement: jest.fn().mockReturnValue(0),
      parseTime: jest.fn((value: any) => value)
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

    const Sentinelle = require('./sentinelle').default; // tslint:disable-line no-require-imports

    sent = Sentinelle({
      entry: ENTRY,
      bin: BIN,
      extraArgs: EXTRA_ARGS,
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

    it('should spawn a child process using the configured "bin", "entry", "extraArgs", and "stdio" options', () => {
      expect(spawnSpy.mock.calls[0]).toMatchObject([
        BIN,
        [...EXTRA_ARGS, ENTRY],
        {stdio: STDIO}
      ]);
    });

    it('should send a kill signal to the child process using the configured signal', async () => {
      await chokidarWatchEmitter.emit('change');

      // Assert that we called kill() with SIGINT.
      // @ts-ignore
      expect(childProcessEmitter.kill.mock.calls[0][0]).toBe(PROCESS_SHUTDOWN_SIGNAL);
    });

    it('start a force-kill timeout using the configured grace period', async () => {
      await chokidarWatchEmitter.emit('change');

      // Assert that we started a timeout using the configured grace period.
      // @ts-ignore
      expect(setTimeoutSpy.mock.calls[0][1]).toBe(PROCESS_SHUTDOWN_GRACE_PERIOD);
    });

    it('should start a new child process using the configured parameters', async () => {
      await chokidarWatchEmitter.emit('change');

      // Assert that we re-started our process.
      expect(spawnSpy.mock.calls[1]).toMatchObject([
        BIN,
        [...EXTRA_ARGS, ENTRY],
        {stdio: STDIO}
      ]);
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
      // @ts-ignore
      expect(childProcessEmitter.kill).toHaveBeenCalledWith(CUSTOM_SIGNAL);
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
    jest.unmock('chokidar');
    jest.unmock('lib/utils');
    jest.resetModuleRegistry();
    spawnSpy.mockRestore();
    statSyncSpy.mockRestore();
    setTimeoutSpy.mockRestore();
  });
});
