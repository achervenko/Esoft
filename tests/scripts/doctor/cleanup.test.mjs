import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import test from 'node:test';

import { createCleanup } from '../../../scripts/doctor/cleanup.mjs';
import {
  beginStartupOperation,
  getCleanupStateVersion,
  notifyCleanupStateChanged,
  waitForCleanupStateChange,
} from '../../../scripts/doctor/resource-registry.mjs';

test('cleanup drains processes added while cleanup is running', async () => {
  const cleanupState = { started: false };
  const entries = [];
  const secondProcess = createProcessInfo('frontend');
  const managedProcesses = [createProcessInfo('backend')];
  let secondRegistered = false;

  const cleanup = createCleanup({
    cleanupState,
    managedProcesses,
    managedServices: [],
    report: {
      add: (...args) => {
        entries.push(args);

        if (!secondRegistered && args[0] === 'backend') {
          secondRegistered = true;
          managedProcesses.push(secondProcess);
        }
      },
    },
    runCaptured: async () => ({ ok: true }),
  });

  const result = await cleanup();

  assert.deepEqual(result, { cleanupErrors: 0 });
  assert.equal(cleanupState.started, true);
  assert.equal(managedProcesses.length, 0);
  assert.deepEqual(entries, [
    ['backend', 'STOPPED', 'Backend stopped'],
    ['frontend', 'STOPPED', 'Frontend stopped'],
  ]);
});

test('cleanup drains resources registered after initially empty collections', async () => {
  const cleanupState = { started: false };
  const entries = [];
  const managedProcesses = [];
  const managedServices = [];
  const finishStartup = beginStartupOperation(cleanupState);

  const cleanup = createCleanup({
    cleanupState,
    managedProcesses,
    managedServices,
    report: {
      add: (...args) => entries.push(args),
    },
    runCaptured: async () => serviceStoppedCommandResult(),
  });

  queueMicrotask(() => {
    managedProcesses.push(createProcessInfo('backend'));
    managedServices.push({
      name: 'PostgreSQL',
      serviceName: 'postgresql-x64-17',
    });
    finishStartup();
  });

  const result = await cleanup();

  assert.equal(result.cleanupErrors, 0);
  assert.equal(managedProcesses.length, 0);
  assert.equal(managedServices.length, 0);
  assert.equal(
    entries.some(
      (entry) =>
        entry[0] === 'backend' &&
        entry[1] === 'STOPPED' &&
        entry[2] === 'Backend stopped',
    ),
    true,
  );
  assert.equal(
    entries.some(
      (entry) =>
        entry[0] === 'PostgreSQL' &&
        entry[1] === 'STOPPED' &&
        entry[2] === 'Initial service state restored',
    ),
    true,
  );
});

test('cleanup waits for active startup operations before finishing', async () => {
  const cleanupState = { started: false };
  const entries = [];
  const managedProcesses = [];
  const finishStartup = beginStartupOperation(cleanupState);

  setTimeout(() => {
    managedProcesses.push(createProcessInfo('backend'));
    finishStartup();
  }, 10);

  const cleanup = createCleanup({
    cleanupState,
    managedProcesses,
    managedServices: [],
    report: {
      add: (...args) => entries.push(args),
    },
    runCaptured: async () => ({ ok: true }),
  });

  const result = await cleanup();

  assert.deepEqual(result, { cleanupErrors: 0 });
  assert.equal(managedProcesses.length, 0);
  assert.deepEqual(entries, [['backend', 'STOPPED', 'Backend stopped']]);
});

test('cleanup state wait resolves when the observed version already changed', async () => {
  const cleanupState = { started: false };
  const version = getCleanupStateVersion(cleanupState);

  notifyCleanupStateChanged(cleanupState);

  await waitForCleanupStateChange(cleanupState, version);
  assert.equal(cleanupState.waiters, undefined);
});

test('startup registration is rejected after cleanup starts', () => {
  assert.throws(
    () => beginStartupOperation({ started: true }),
    /Cleanup has already started/,
  );
});

test('cleanup continues after process and port cleanup failures', async () => {
  const cleanupState = { started: false };
  const entries = [];
  const managedProcesses = [
    createProcessInfo('frontend'),
    {
      child: {
        get pid() {
          throw new Error('pid unavailable');
        },
      },
      name: 'backend',
      ports: [0],
    },
  ];

  const cleanup = createCleanup({
    cleanupState,
    managedProcesses,
    managedServices: [],
    report: {
      add: (...args) => entries.push(args),
    },
    runCaptured: async () => ({ ok: true }),
  });

  const result = await cleanup();
  const secondResult = await cleanup();

  assert.deepEqual(secondResult, result);
  assert.equal(result.cleanupErrors, 2);
  assert.equal(managedProcesses.length, 0);
  assert.deepEqual(entries, [
    ['backend', 'ERROR', 'Process cleanup failed: pid unavailable'],
    ['backend', 'ERROR', 'Port 0 cleanup failed: port must be an integer from 1 to 65535'],
    ['frontend', 'STOPPED', 'Frontend stopped'],
  ]);
});

test('cleanup continues after service cleanup failure', async () => {
  const cleanupState = { started: false };
  const entries = [];
  const managedServices = [
    {
      name: 'PostgreSQL',
      serviceName: 'postgresql-x64-17',
    },
    {
      get serviceName() {
        throw new Error('service name unavailable');
      },
      name: 'Broken service',
    },
  ];

  const cleanup = createCleanup({
    cleanupState,
    managedProcesses: [],
    managedServices,
    report: {
      add: (...args) => entries.push(args),
    },
    runCaptured: async () => serviceStoppedCommandResult(),
  });

  const result = await cleanup();

  assert.equal(result.cleanupErrors, 1);
  assert.equal(managedServices.length, 0);
  assert.deepEqual(entries, [
    ['Broken service', 'ERROR', 'Service cleanup failed: service name unavailable'],
    ['PostgreSQL', 'STOPPED', 'Initial service state restored'],
  ]);
});

function createProcessInfo(name) {
  const child = new EventEmitter();
  child.exitCode = null;
  child.pid = undefined;
  child.signalCode = null;

  return {
    child,
    name,
    ports: [],
  };
}

function serviceStoppedCommandResult() {
  return {
    code: 0,
    ok: true,
    stderr: '',
    stdout: 'STATE              : 1  STOPPED',
    timedOut: false,
  };
}
