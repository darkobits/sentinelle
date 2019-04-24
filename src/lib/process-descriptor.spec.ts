import childProcess from 'child_process';
import uuid from 'uuid/v4';
import Emittery from 'emittery';


describe('Process Descriptor', () => {
  let spawnSpy: jest.SpyInstance;
  let processHandle: any;
  // let ProcessDescriptor: Function;
  let pd: any;

  const eventSpies: any = {};

  const BIN = uuid();
  const ARGS = [uuid(), uuid(), uuid()];
  const STDIO = [uuid(), uuid(), uuid()];

  beforeEach(() => {
    spawnSpy = jest.spyOn(childProcess, 'spawn');

    spawnSpy.mockImplementation((...args) => {
      // console.warn('[spawn] Called with:', args);
      return processHandle;
    });

    const emitter = new Emittery();

    processHandle = {
      on: jest.fn((eventName, handler) => {
        // console.warn('[on] Called with:', eventName, handler);

        const wrappedHandler = jest.fn(handler);
        eventSpies[eventName] = wrappedHandler;
        return emitter.on(eventName, wrappedHandler);
      }),
      kill: jest.fn(() => {
        emitter.emit('close', null); // tslint:disable-line no-null-keyword no-floating-promises
      }),
      stdout: {
        on: jest.fn(),
        pipe: jest.fn()
      },
      stderr: {
        on: jest.fn(),
        pipe: jest.fn()
      },
      emit: emitter.emit.bind(emitter)
    };

    const ProcessDescriptor = require('./process-descriptor').default; // tslint:disable-line no-require-imports
    pd = ProcessDescriptor({bin: BIN, args: ARGS, stdio: STDIO});
  });

  describe('starting a new process', () => {
    it('should spawn a new process', () => {
      expect(spawnSpy.mock.calls[0]).toMatchObject([BIN, ARGS, {stdio: STDIO, detached: true}]);
    });

    it('should register event handlers', () => {
      expect(processHandle.on.mock.calls[0][0]).toBe('message');
      expect(processHandle.on.mock.calls[1][0]).toBe('close');
      expect(processHandle.on.mock.calls[2][0]).toBe('error');
    });

    it('should pipe stdio streams', () => {
      expect(processHandle.stdout.pipe).toHaveBeenCalled();
      expect(processHandle.stderr.pipe).toHaveBeenCalled();
    });

    it('should respond to events', async () => {
      await processHandle.emit('message');
      expect(eventSpies.message).toHaveBeenCalled();

      // await processHandle.emit('close');
      // expect(eventSpies.close).toHaveBeenCalled();

      await processHandle.emit('error', new Error());
      expect(eventSpies.error).toHaveBeenCalled();
    });
  });

  describe('#getState', () => {
    it('should return the current state', async () => {
      expect(pd.getState()).toBe('STARTED');

      const closePromise = pd.kill();
      expect(pd.getState()).toBe('STOPPING');

      await closePromise;
      expect(pd.getState()).toBe('STOPPED');
    });
  });

  describe('#kill', () => {
    it('should send an interrupt signal and return a promise', async () => {
      await pd.kill();
      expect(processHandle.kill).toHaveBeenCalled();
    });
  });

  describe('#killAfterGracePeriod', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should wait the indicated time then kill the process', () => {
      pd.killAfterGracePeriod(4000);
      jest.advanceTimersByTime(2000);
      expect(processHandle.kill).not.toHaveBeenCalled();
      jest.advanceTimersByTime(2500);
      expect(processHandle.kill).toHaveBeenCalledTimes(1);
    });
  });

  describe('#isClosed', () => {
    it('should return true when the process has closed', async () => {
      expect(pd.isClosed()).toBe(false);
      await pd.kill();
      expect(pd.isClosed()).toBe(true);
    });
  });
});
