import assert from 'node:assert/strict';
import test from 'node:test';

import { startPostgresService } from '../../../scripts/doctor/postgres.mjs';

test('startPostgresService stops service when shutdown starts during registration', async () => {
  const calls = [];
  const entries = [];
  const managedServices = [];
  let shutdownChecks = 0;

  const result = await startPostgresService('postgresql-x64-17', {
    cleanupState: { started: false },
    isShuttingDown: () => {
      shutdownChecks += 1;
      return shutdownChecks > 1;
    },
    managedServices,
    platform: 'win32',
    report: {
      add: (...args) => entries.push(args),
    },
    runCaptured: async (...args) => {
      calls.push(args);

      const [, commandArgs] = args;

      if (commandArgs[0] === 'query') {
        return {
          code: 0,
          ok: true,
          stderr: '',
          stdout: 'STATE              : 1  STOPPED',
          timedOut: false,
        };
      }

      return {
        code: 0,
        ok: true,
        stderr: '',
        stdout: '',
        timedOut: false,
      };
    },
  });

  assert.deepEqual(result, {
    ok: false,
    startRequested: false,
  });
  assert.equal(managedServices.length, 0);
  assert.deepEqual(entries, []);
  assert.deepEqual(calls, [
    ['sc.exe', ['start', 'postgresql-x64-17'], { timeoutMs: 20_000 }],
    ['sc.exe', ['stop', 'postgresql-x64-17'], { timeoutMs: 20_000 }],
    ['sc.exe', ['query', 'postgresql-x64-17'], { timeoutMs: 10_000 }],
  ]);
});

test('startPostgresService keeps service registered when shutdown restoration fails', async () => {
  const entries = [];
  const managedServices = [];
  let shutdownChecks = 0;

  const result = await startPostgresService('postgresql-x64-17', {
    cleanupState: { started: false },
    isShuttingDown: () => {
      shutdownChecks += 1;
      return shutdownChecks > 1;
    },
    managedServices,
    platform: 'win32',
    report: {
      add: (...args) => entries.push(args),
    },
    runCaptured: async (_command, commandArgs) => {
      if (commandArgs[0] === 'stop') {
        return {
          code: 1,
          ok: false,
          stderr: 'stop failed',
          stdout: '',
          timedOut: false,
        };
      }

      return {
        code: 0,
        ok: true,
        stderr: '',
        stdout: '',
        timedOut: false,
      };
    },
  });

  assert.deepEqual(result, {
    ok: false,
    startRequested: false,
  });
  assert.deepEqual(managedServices, [
    {
      name: 'PostgreSQL',
      serviceName: 'postgresql-x64-17',
    },
  ]);
  assert.deepEqual(entries, [
    ['PostgreSQL', 'ERROR', 'Initial service state was not restored'],
  ]);
});

test('startPostgresService keeps service registered when shutdown restoration rejects', async () => {
  const entries = [];
  const managedServices = [];
  let shutdownChecks = 0;

  const result = await startPostgresService('postgresql-x64-17', {
    cleanupState: { started: false },
    isShuttingDown: () => {
      shutdownChecks += 1;
      return shutdownChecks > 1;
    },
    managedServices,
    platform: 'win32',
    report: {
      add: (...args) => entries.push(args),
    },
    runCaptured: async (_command, commandArgs) => {
      if (commandArgs[0] === 'stop') {
        throw new Error('stop runner failed');
      }

      return {
        code: 0,
        ok: true,
        stderr: '',
        stdout: '',
        timedOut: false,
      };
    },
  });

  assert.deepEqual(result, {
    ok: false,
    startRequested: false,
  });
  assert.deepEqual(managedServices, [
    {
      name: 'PostgreSQL',
      serviceName: 'postgresql-x64-17',
    },
  ]);
  assert.deepEqual(entries, [
    [
      'PostgreSQL',
      'ERROR',
      'Initial service state restoration failed: stop runner failed',
    ],
    ['PostgreSQL', 'ERROR', 'Initial service state was not restored'],
  ]);
});

test('startPostgresService registers service before reporting restoration failure', async () => {
  const managedServices = [];
  let shutdownChecks = 0;

  await assert.rejects(
    () =>
      startPostgresService('postgresql-x64-17', {
        cleanupState: { started: false },
        isShuttingDown: () => {
          shutdownChecks += 1;
          return shutdownChecks > 1;
        },
        managedServices,
        platform: 'win32',
        report: {
          add: () => {
            throw new Error('report failed');
          },
        },
        runCaptured: async (_command, commandArgs) => {
          if (commandArgs[0] === 'stop') {
            return {
              code: 1,
              ok: false,
              stderr: 'stop failed',
              stdout: '',
              timedOut: false,
            };
          }

          return {
            code: 0,
            ok: true,
            stderr: '',
            stdout: '',
            timedOut: false,
          };
        },
      }),
    /report failed/,
  );

  assert.deepEqual(managedServices, [
    {
      name: 'PostgreSQL',
      serviceName: 'postgresql-x64-17',
    },
  ]);
});
