import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  addStoppedProcessReport,
  startManagedProcess,
} from '../../../scripts/doctor/processes.mjs';
import { SECRET_MARKERS } from '../helpers/operation-result.mjs';

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

test('startManagedProcess wraps Windows batch commands before spawn', async () => {
  const child = new EventEmitter();
  child.exitCode = null;
  child.pid = 12345;
  child.signalCode = null;
  const cleanupState = { started: false };
  const managedProcesses = [];
  let spawnCall = null;

  const result = await startManagedProcess(
    'backend',
    'npm.cmd',
    ['run', 'start', '--workspace', 'backend'],
    {
      cleanupState,
      comSpec: 'C:/Windows/System32/cmd.exe',
      isShuttingDown: () => false,
      managedProcesses,
      platform: 'win32',
      projectRoot: resolve(__dirname, '../../..'),
      report: {
        add: () => undefined,
      },
      spawnImpl: (command, args, options) => {
        spawnCall = { args, command, options };
        queueMicrotask(() => {
          child.emit('spawn');
        });

        return child;
      },
    },
  );

  assert.equal(result.ok, true);
  assert.equal(spawnCall.command, 'C:/Windows/System32/cmd.exe');
  assert.deepEqual(spawnCall.args.slice(0, 3), ['/d', '/s', '/c']);
  assert.equal(spawnCall.options.detached, false);
  assert.equal(spawnCall.options.windowsVerbatimArguments, true);
});

test('startManagedProcess redacts spawn exceptions', async () => {
  const result = await startManagedProcess(
    'backend',
    process.execPath,
    ['server.js'],
    {
      cleanupState: { started: false },
      isShuttingDown: () => false,
      managedProcesses: [],
      projectRoot: resolve(__dirname, '../../..'),
      report: {
        add: () => undefined,
      },
      spawnImpl: () => {
        throw new Error(`spawn failed ${SECRET_MARKERS[0]}`);
      },
    },
  );

  assert.equal(result.ok, false);
  assert.match(result.message, /spawn failed/);
  assert.doesNotMatch(result.message, new RegExp(SECRET_MARKERS[0]));
});

test('startManagedProcess redacts asynchronous spawn errors', async () => {
  const child = new EventEmitter();
  child.exitCode = null;
  child.pid = undefined;
  child.signalCode = null;
  const managedProcesses = [];

  const result = await startManagedProcess(
    'backend',
    process.execPath,
    ['server.js'],
    {
      cleanupState: { started: false },
      isShuttingDown: () => false,
      managedProcesses,
      projectRoot: resolve(__dirname, '../../..'),
      report: {
        add: () => undefined,
      },
      spawnImpl: () => {
        queueMicrotask(() => {
          child.emit('error', new Error(`spawn failed ${SECRET_MARKERS[0]}`));
        });

        return child;
      },
    },
  );

  assert.equal(result.ok, false);
  assert.match(result.message, /spawn failed/);
  assert.doesNotMatch(result.message, new RegExp(SECRET_MARKERS[0]));
  assert.equal(managedProcesses.length, 0);
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
