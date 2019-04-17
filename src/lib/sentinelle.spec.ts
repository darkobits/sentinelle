import fs from 'fs';
import sleep from '@darkobits/sleep';
import Emittery from 'emittery';
import uuid from 'uuid/v4';


describe('Sentinelle', () => {
  let sent: any;
  let statSyncSpy: jest.Mock<fs.Stats, [fs.PathLike]>;

  // ----- Test Data -----------------------------------------------------------

  const ENTRY_PATH = `/${uuid()}`;
  const ENTRY = `${ENTRY_PATH}/${uuid()}`;
  const EXTRA_WATCHES = [`/${uuid()}`, `/${uuid()}.txt`, `/${uuid()}.js`];
  const BIN = uuid();
  const STDIO = uuid();
  const EXTRA_ARGS = [uuid(), uuid(), uuid()];
  const PROCESS_SHUTDOWN_SIGNAL = uuid();
  const PROCESS_SHUTDOWN_GRACE_PERIOD = 99919194325;


  // ----- Spies ---------------------------------------------------------------

  const sleepSpy = jest.fn(() => Promise.resolve());

  const chokidarWatchEmitter = new Emittery();

  // @ts-ignore
  chokidarWatchEmitter.close = jest.fn();

  const chokidarWatchSpy = jest.fn((...args) => {
    // console.warn('[chokidar] Got args:', args);
    return chokidarWatchEmitter;
  });

  const childProcessEmitter = new Emittery();

  // @ts-ignore
  childProcessEmitter.kill = jest.fn(async () => {
    // This sets the process state to "KILLED", but its the only path we can
    // take without throwing an error, because Emittery only allows us to pass a
    // single argument to emit();
    await sleep(1000);
    return childProcessEmitter.emit('close', null); // tslint:disable-line no-null-keyword
  });

  const childProcessSpawnSpy = jest.fn((...args) => {
    // console.warn('[spawn] Got args:', args);
    return childProcessEmitter;
  });


  // ----- Mocks ---------------------------------------------------------------

  beforeAll(async () => {
    jest.doMock('@darkobits/sleep', () => sleepSpy);

    jest.doMock('chokidar', () => ({
      watch: chokidarWatchSpy
    }));

    jest.doMock('child_process', () => ({
      spawn: childProcessSpawnSpy
    }));

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

    return sent.start();
  });

  it('should create watchers using the configured "entry" and "watch" options', () => {
    // Asserts correct behavior of "entry" and "watch" options.
    expect(chokidarWatchSpy.mock.calls[0][0]).toMatchObject([
      ENTRY_PATH,
      ...EXTRA_WATCHES
    ]);
  });

  it('spawn a child process using the configured "bin", "entry", "extraArgs", and "stdio" options', () => {
    expect(childProcessSpawnSpy.mock.calls[0]).toMatchObject([
      BIN,
      [...EXTRA_ARGS, ENTRY],
      {stdio: STDIO}
    ]);
  });

  it('should send a kill signal to the child process using the configured signal', async () => {
    await chokidarWatchEmitter.emit('change');

    // Assert that we called kill() with SIGUSR2.
    // @ts-ignore
    expect(childProcessEmitter.kill.mock.calls[0][0]).toBe(PROCESS_SHUTDOWN_SIGNAL);
  });

  it('start a force-kill timeout using the configured grace period', () => {
    // Assert that we started a timeout using the configured grace period.
    // @ts-ignore
    expect(sleepSpy.mock.calls[0][0]).toBe(PROCESS_SHUTDOWN_GRACE_PERIOD);
  });

  it('should start a new child process using the configured parameters', () => {
    // Assert that we re-started our process.
    expect(childProcessSpawnSpy.mock.calls[1]).toMatchObject([
      BIN,
      [...EXTRA_ARGS, ENTRY],
      {stdio: STDIO}
    ]);
  });

  // TODO: Actually test for something here.
  describe('on watcher errors', () => {
    it('should log an error event?', async () => {
      const err = new Error(uuid());
      await chokidarWatchEmitter.emit('error', err);
    });
  });

  describe('#stop', () => {
    const CUSTOM_SIGNAL = uuid();

    beforeAll(async () => {
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

  afterAll(() => {
    jest.unmock('chokidar');
    jest.unmock('child_process');
    statSyncSpy.mockRestore();
  });
});
