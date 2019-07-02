import EventEmitter from 'events';

import log from 'lib/log';


// ----- Test Helpers ----------------------------------------------------------

function createMockProcessHandle(eventEmitter: EventEmitter) {
  const eventSpies: any = {};

  const stdout = new EventEmitter();
  // @ts-ignore
  stdout.pipe = jest.fn();

  const stderr = new EventEmitter();
  // @ts-ignore
  stderr.pipe = jest.fn();

  return {
    on: jest.fn((eventName, handler) => {
      const wrappedHandler = jest.fn(handler);
      eventSpies[eventName] = wrappedHandler;
      return eventEmitter.on(eventName, wrappedHandler);
    }),
    kill: jest.fn((signal: string) => {
      if (signal !== 'FAIL_TO_CLOSE') {
        eventEmitter.emit('close', 0, signal);
      }
    }),
    stdout,
    stderr,
    emit: eventEmitter.emit.bind(eventEmitter),
    _eventSpies: eventSpies,
    catch: jest.fn()
  };
}


// ----- Test Data -------------------------------------------------------------

const BIN = '__BIN__';
const ARGS = ['__ARG1__', '__ARG2__', '__ARG3__'];
const STDIO = ['__STDIO1__', '__STDIO2__', '__STDIO3__'];


describe('Process Descriptor', () => {
  let execaSpy: jest.SpyInstance;
  let processHandle: any;
  let pd: any;


  beforeEach(() => {
    const emitter = new EventEmitter();
    processHandle = createMockProcessHandle(emitter);

    execaSpy = jest.fn((...args) => {
      // console.warn('[spawn] Called with:', args);
      return processHandle;
    });

    jest.doMock('execa', () => execaSpy);

    const ProcessDescriptor = require('./process-descriptor'); // tslint:disable-line no-require-imports
    pd = ProcessDescriptor({bin: BIN, args: ARGS, stdio: STDIO});
  });

  describe('starting a new process', () => {
    it('should spawn a new process', () => {
      expect(execaSpy.mock.calls[0]).toMatchObject([BIN, ARGS, {stdio: STDIO, detached: true}]);
    });

    it('should register event handlers', () => {
      const firstArgs = processHandle.on.mock.calls.map((args: Array<any>) => args[0]);

      expect(firstArgs).toContain('message');
      expect(firstArgs).toContain('close');
      expect(firstArgs).toContain('error');
    });

    it('should pipe stdio streams', () => {
      expect(processHandle.stdout.pipe).toHaveBeenCalled();
      expect(processHandle.stderr.pipe).toHaveBeenCalled();
    });

    it('should respond to events', async () => {
      await processHandle.emit('message');
      expect(processHandle._eventSpies.message).toHaveBeenCalled();

      await processHandle.emit('close', 0, 'SIGINT');
      expect(processHandle._eventSpies.close).toHaveBeenCalled();

      await processHandle.emit('error', new Error());
      expect(processHandle._eventSpies.error).toHaveBeenCalled();
    });
  });

  describe('handling errors', () => {
    let warnSpy: jest.SpyInstance<void, [string, any, ...Array<any>]>;
    let errorSpy: jest.SpyInstance<void, [string, any, ...Array<any>]>;

    beforeEach(() => {
      warnSpy = jest.spyOn(log, 'warn');
      errorSpy = jest.spyOn(log, 'error');
    });

    it('should ignore selected error messages', () => {
      processHandle.emit('error', new Error('Command failed'));
      processHandle.emit('error', new Error('Command was killed with'));

      expect(warnSpy).not.toHaveBeenCalled();
      expect(errorSpy).not.toHaveBeenCalled();
    });

    it('should issue hints on appropriate errors', () => {
      const enoentErr = new Error('ENOENT');
      // @ts-ignore
      enoentErr.exitCodeName = 'ENOENT';
      processHandle.emit('error', enoentErr);
      expect(errorSpy.mock.calls[1][1]).toMatch('shebang');

      const eaccesErr = new Error('EACCES');
      // @ts-ignore
      eaccesErr.exitCodeName = 'EACCES';
      processHandle.emit('error', eaccesErr);
      expect(errorSpy.mock.calls[3][1]).toMatch('executable');
    });
  });

  describe('handling debugger quirks', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    describe('when there is a debugger attached', () => {
      it('should wait the indicated time then kill the process with SIGKILL', () => {
        processHandle.stderr.emit('data', 'Debugger attached');

        // Tell our mock emitter to not actually emit the 'close' event,
        // simulating an attached debugger instance.
        pd.kill('FAIL_TO_CLOSE');

        jest.advanceTimersByTime(2000);
        expect(processHandle.kill).toHaveBeenCalledTimes(1);
        jest.advanceTimersByTime(2500);
        expect(processHandle.kill).toHaveBeenCalledTimes(2);
        expect(processHandle.kill).toHaveBeenCalledWith('SIGKILL');
      });
    });

    describe('when there is a hanging debugger', () => {
      it('should wait the indicated time then kill the process with SIGKILL', () => {
        processHandle.stderr.emit('data', 'Waiting for the debugger to disconnect');

        // Tell our mock emitter to not actually emit the 'close' event,
        // simulating an attached debugger instance.
        pd.kill('FAIL_TO_CLOSE');

        jest.advanceTimersByTime(2000);
        expect(processHandle.kill).toHaveBeenCalledTimes(2);
        jest.advanceTimersByTime(2100);
        expect(processHandle.kill).toHaveBeenCalledTimes(3);
        expect(processHandle.kill).toHaveBeenCalledWith('SIGKILL');
      });
    });
  });

  describe('#getState', () => {
    it('should return the current state', async () => {
      expect(pd.getState()).toBe('STARTED');
      pd.kill();
      expect(pd.getState()).toBe('STOPPED');
    });
  });

  describe('#kill', () => {
    it('should send an interrupt signal and return a promise', async () => {
      await pd.kill();
      expect(processHandle.kill).toHaveBeenCalled();
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
