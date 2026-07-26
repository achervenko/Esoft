import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  addStoppedProcessReport,
  startManagedProcess,
  stopManagedProcess,
  waitForExit,
} from '../../../scripts/doctor/processes.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

test('startManagedProcess reports unexpected successful exit', async () => {
  const child = new EventEmitter();
  child.exitCode = null;
  child.pid = 12345;
  child.signalCode = null;
  const cleanupState = { started: false };
  const entries = [];
  const managedProcesses = [];

  const result = await startManagedProcess(
    'backend',
    'node',
    ['server.js'],
    {
      cleanupState,
      isShuttingDown: () => false,
      managedProcesses,
      projectRoot: resolve(__dirname, '../../..'),
      report: {
        add: (...args) => entries.push(args),
      },
      spawnImpl: () => {
        queueMicrotask(() => {
          child.emit('spawn');
        });

        return child;
      },
    },
  );

  assert.deepEqual(result, { ok: true });
  assert.equal(managedProcesses.length, 1);

  child.exitCode = 0;
  child.emit('exit', 0, null);

  assert.deepEqual(entries, [
    ['backend', 'ERROR', 'Exited unexpectedly with code 0'],
  ]);
});

test('startManagedProcess stops a process when shutdown starts during registration', async () => {
  const cleanupState = { started: false };
  const entries = [];
  const managedProcesses = [];
  let shutdownChecks = 0;

  const result = await startManagedProcess(
    'backend',
    process.execPath,
    ['-e', 'setInterval(() => undefined, 1000)'],
    {
      cleanupState,
      isShuttingDown: () => {
        shutdownChecks += 1;
        return shutdownChecks > 1;
      },
      managedProcesses,
      projectRoot: resolve(__dirname, '../../..'),
      report: {
        add: (...args) => entries.push(args),
      },
    },
  );

  assert.equal(result.ok, false);
  assert.equal(
    result.message,
    'Shutdown started before process startup completed',
  );
  assert.equal(managedProcesses.length, 0);
  assert.deepEqual(entries, []);
});

test('startManagedProcess stops a process that exits before registration', async () => {
  const child = new EventEmitter();
  child.exitCode = 7;
  child.pid = 12345;
  child.signalCode = null;
  const cleanupState = { started: false };
  const managedProcesses = [];
  let stoppedProcessInfo = null;

  const result = await startManagedProcess(
    'backend',
    'node',
    ['server.js'],
    {
      cleanupState,
      isShuttingDown: () => false,
      managedProcesses,
      projectRoot: resolve(__dirname, '../../..'),
      report: {
        add: () => undefined,
      },
      spawnImpl: () => {
        queueMicrotask(() => {
          child.emit('spawn');
        });

        return child;
      },
      stopProcess: async (processInfo) => {
        stoppedProcessInfo = processInfo;
        return true;
      },
    },
  );

  assert.deepEqual(result, {
    message: 'Process exited during startup with code 7',
    ok: false,
  });
  assert.equal(managedProcesses.length, 0);
  assert.equal(stoppedProcessInfo?.child, child);
});

test('startManagedProcess reports cleanup failure after exit before registration', async () => {
  const child = new EventEmitter();
  child.exitCode = 7;
  child.pid = 12345;
  child.signalCode = null;
  const cleanupState = { started: false };

  const result = await startManagedProcess(
    'backend',
    'node',
    ['server.js'],
    {
      cleanupState,
      isShuttingDown: () => false,
      managedProcesses: [],
      projectRoot: resolve(__dirname, '../../..'),
      report: {
        add: () => undefined,
      },
      spawnImpl: () => {
        queueMicrotask(() => {
          child.emit('spawn');
        });

        return child;
      },
      stopProcess: async () => false,
    },
  );

  assert.deepEqual(result, {
    message:
      'Process exited during startup with code 7; Process cleanup failed after startup was cancelled',
    ok: false,
  });
});

test('startManagedProcess reports cleanup exception during shutdown registration race', async () => {
  const child = new EventEmitter();
  child.exitCode = null;
  child.pid = 12345;
  child.signalCode = null;
  const cleanupState = { started: false };
  const managedProcesses = [];
  let shutdownChecks = 0;

  const result = await startManagedProcess(
    'backend',
    'node',
    ['server.js'],
    {
      cleanupState,
      isShuttingDown: () => {
        shutdownChecks += 1;
        return shutdownChecks > 2;
      },
      managedProcesses,
      projectRoot: resolve(__dirname, '../../..'),
      report: {
        add: () => undefined,
      },
      spawnImpl: () => {
        queueMicrotask(() => {
          child.emit('spawn');
        });

        return child;
      },
      stopProcess: async () => {
        throw new Error('cleanup failed');
      },
    },
  );

  assert.deepEqual(result, {
    message:
      'Shutdown started before process startup completed; Process cleanup failed: cleanup failed',
    ok: false,
  });
  assert.equal(managedProcesses.length, 0);
});

test('stopManagedProcess stops a POSIX process group after the leader exited', async () => {
  const signals = [];
  let groupRunning = true;

  const stopped = await stopManagedProcess(
    {
      child: {
        exitCode: 0,
        pid: 12345,
        signalCode: null,
      },
      name: 'backend',
      ports: [],
    },
    {
      groupPollIntervalMs: 1,
      killGraceMs: 0,
      killProcess: (pid, signal) => {
        assert.equal(pid, -12345);

        if (signal === 0) {
          if (!groupRunning) {
            const error = new Error('missing');
            error.code = 'ESRCH';
            throw error;
          }

          return;
        }

        signals.push(signal);

        if (signal === 'SIGKILL') {
          groupRunning = false;
        }
      },
      platform: 'linux',
      terminationGraceMs: 0,
    },
  );

  assert.equal(stopped, true);
  assert.deepEqual(signals, ['SIGTERM', 'SIGKILL']);
});

test('waitForExit resolves immediately for an already exited child process', async () => {
  const child = new EventEmitter();
  child.exitCode = 0;
  child.signalCode = null;

  assert.equal(await waitForExit(child, 1), true);
  assert.equal(child.listenerCount('exit'), 0);
});

test('waitForExit resolves immediately for a child terminated by signal', async () => {
  const child = new EventEmitter();
  child.exitCode = null;
  child.signalCode = 'SIGTERM';

  assert.equal(await waitForExit(child, 100), true);
  assert.equal(child.listenerCount('exit'), 0);
});

test('waitForExit validates timeout', async () => {
  const child = new EventEmitter();
  child.exitCode = null;
  child.signalCode = null;

  assert.throws(() => waitForExit(child, -1), /timeoutMs/);
});

test('waitForExit waits for the child exit event', async () => {
  const child = new EventEmitter();
  child.exitCode = null;
  child.signalCode = null;
  const wait = waitForExit(child, 100);

  child.exitCode = 0;
  child.emit('exit', 0, null);

  assert.equal(await wait, true);
  assert.equal(child.listenerCount('exit'), 0);
});

test('waitForExit returns false after timeout', async () => {
  const child = new EventEmitter();
  child.exitCode = null;
  child.signalCode = null;

  const result = await waitForExit(child, 10);

  assert.equal(result, false);
  assert.equal(child.listenerCount('exit'), 0);
});

test('addStoppedProcessReport records successful cleanup', () => {
  const entries = [];
  const result = addStoppedProcessReport(
    {
      add: (...args) => entries.push(args),
    },
    {
      name: 'backend',
    },
    true,
  );

  assert.equal(result, 0);
  assert.deepEqual(entries, [['backend', 'STOPPED', 'Backend stopped']]);
});

test('addStoppedProcessReport records cleanup failure', () => {
  const entries = [];
  const result = addStoppedProcessReport(
    {
      add: (...args) => entries.push(args),
    },
    {
      name: 'frontend',
    },
    false,
  );

  assert.equal(result, 1);
  assert.deepEqual(entries, [['frontend', 'ERROR', 'Frontend cleanup failed']]);
});
