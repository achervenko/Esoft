import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getPostgresServiceState,
  isWindowsAccessDenied,
  startPostgresService,
  stopPostgresService,
} from '../../../../scripts/infrastructure/postgres/service.mjs';
import {
  assertNoSecretLeak,
  assertOperationResult,
  SECRET_MARKERS,
} from '../../helpers/operation-result.mjs';

test('getPostgresServiceState queries the Windows service and parses state', async () => {
  const calls = [];

  const result = await getPostgresServiceState('postgresql-x64-17', {
    platform: 'win32',
    runCommand: async (...args) => {
      calls.push(args);

      return {
        code: 0,
        ok: true,
        stderr: '',
        stdout: 'STATE              : 4  RUNNING',
        timedOut: false,
      };
    },
    timeoutMs: 123,
  });

  assertOperationResult(result, { ok: true });
  assert.equal(result.code, 'POSTGRES_SERVICE_STATE_READ');
  assert.deepEqual(result.details, {
    serviceName: 'postgresql-x64-17',
    state: 'RUNNING',
  });
  assert.deepEqual(calls, [
    [
      'sc.exe',
      ['query', 'postgresql-x64-17'],
      {
        timeoutMs: 123,
      },
    ],
  ]);
});

test('getPostgresServiceState classifies a missing Windows service from sc.exe output', async () => {
  const result = await getPostgresServiceState('postgresql-x64-17', {
    platform: 'win32',
    runCommand: async () => ({
      code: 1,
      ok: false,
      stderr: '[SC] EnumQueryServicesStatus:OpenService FAILED 1060: specified service does not exist',
      stdout: '',
      timedOut: false,
    }),
  });

  assertOperationResult(result, { ok: false });
  assert.equal(result.code, 'POSTGRES_SERVICE_NOT_FOUND');
  assert.equal(result.details.code, 1);
});

test('getPostgresServiceState parses stopped state', async () => {
  const result = await getPostgresServiceState('postgresql-x64-17', {
    platform: 'win32',
    runCommand: async () => ({
      code: 0,
      ok: true,
      stderr: '',
      stdout: 'STATE              : 1  STOPPED',
      timedOut: false,
    }),
  });

  assertOperationResult(result, { ok: true });
  assert.equal(result.code, 'POSTGRES_SERVICE_STATE_READ');
  assert.deepEqual(result.details, {
    serviceName: 'postgresql-x64-17',
    state: 'STOPPED',
  });
});

test('getPostgresServiceState reports timeout separately', async () => {
  const result = await getPostgresServiceState('postgresql-x64-17', {
    platform: 'win32',
    runCommand: async () => ({
      code: null,
      ok: false,
      stderr: '',
      stdout: '',
      timedOut: true,
    }),
  });

  assertOperationResult(result, { ok: false });
  assert.equal(result.code, 'POSTGRES_SERVICE_CHECK_TIMEOUT');
  assert.equal(result.details.timedOut, true);
});

test('getPostgresServiceState reports access denied separately', async () => {
  const result = await getPostgresServiceState('postgresql-x64-17', {
    platform: 'win32',
    runCommand: async () => ({
      code: 5,
      ok: false,
      stderr: '',
      stdout: '',
      timedOut: false,
    }),
  });

  assertOperationResult(result, { ok: false });
  assert.equal(result.code, 'POSTGRES_SERVICE_CHECK_ACCESS_DENIED');
  assert.equal(result.details.code, 5);
});

test('getPostgresServiceState reports unparsable service output', async () => {
  const result = await getPostgresServiceState('postgresql-x64-17', {
    platform: 'win32',
    runCommand: async () => ({
      code: 0,
      ok: true,
      stderr: '',
      stdout: 'SERVICE_NAME: postgresql-x64-17',
      timedOut: false,
    }),
  });

  assertOperationResult(result, { ok: false });
  assert.equal(result.code, 'POSTGRES_SERVICE_STATE_UNKNOWN');
  assert.deepEqual(result.details, {
    stdout: 'SERVICE_NAME: postgresql-x64-17',
  });
});

test('getPostgresServiceState redacts unparsable service output', async () => {
  const result = await getPostgresServiceState('postgresql-x64-17', {
    platform: 'win32',
    runCommand: async () => ({
      code: 0,
      ok: true,
      stderr: '',
      stdout: `SERVICE_NAME: postgresql-x64-17 DATABASE_PASSWORD=hunter2 ${SECRET_MARKERS[0]}`,
      timedOut: false,
    }),
  });

  assertOperationResult(result, { ok: false });
  assert.equal(result.code, 'POSTGRES_SERVICE_STATE_UNKNOWN');
  assert.equal(result.details.stdout.includes('hunter2'), false);
  assertNoSecretLeak(result);
});

test('startPostgresService requests service start with exact command arguments', async () => {
  const calls = [];

  const result = await startPostgresService('postgresql-x64-17', {
    platform: 'win32',
    runCommand: async (...args) => {
      calls.push(args);

      return {
        code: 0,
        ok: true,
        stderr: '',
        stdout: '',
        timedOut: false,
      };
    },
    timeoutMs: 456,
  });

  assertOperationResult(result, { ok: true });
  assert.equal(result.code, 'POSTGRES_SERVICE_START_REQUESTED');
  assert.deepEqual(calls, [
    [
      'sc.exe',
      ['start', 'postgresql-x64-17'],
      {
        timeoutMs: 456,
      },
    ],
  ]);
});

test('startPostgresService classifies access denied', async () => {
  const result = await startPostgresService('postgresql-x64-17', {
    platform: 'win32',
    runCommand: async () => ({
      code: 1,
      ok: false,
      stderr: 'Access is denied.',
      stdout: '',
      timedOut: false,
    }),
  });

  assertOperationResult(result, { ok: false });
  assert.equal(result.code, 'POSTGRES_SERVICE_START_ACCESS_DENIED');
  assert.deepEqual(result.details, {
    code: 1,
    stderr: 'Access is denied.',
    stdout: '',
    timedOut: false,
  });
});

test('startPostgresService reports generic command failure with diagnostics', async () => {
  const result = await startPostgresService('postgresql-x64-17', {
    platform: 'win32',
    runCommand: async () => ({
      code: 1,
      ok: false,
      stderr: 'start failed',
      stdout: 'service output',
      timedOut: false,
    }),
  });

  assertOperationResult(result, { ok: false });
  assert.equal(result.code, 'POSTGRES_SERVICE_START_FAILED');
  assert.deepEqual(result.details, {
    code: 1,
    stderr: 'start failed',
    stdout: 'service output',
    timedOut: false,
  });
});

test('stopPostgresService requests service stop with exact command arguments', async () => {
  const calls = [];

  const result = await stopPostgresService('postgresql-x64-17', {
    platform: 'win32',
    runCommand: async (...args) => {
      calls.push(args);

      return {
        code: 0,
        ok: true,
        stderr: '',
        stdout: '',
        timedOut: false,
      };
    },
    timeoutMs: 789,
  });

  assertOperationResult(result, { ok: true });
  assert.equal(result.code, 'POSTGRES_SERVICE_STOP_REQUESTED');
  assert.deepEqual(result.details, {
    serviceName: 'postgresql-x64-17',
  });
  assert.deepEqual(calls, [
    [
      'sc.exe',
      ['stop', 'postgresql-x64-17'],
      {
        timeoutMs: 789,
      },
    ],
  ]);
});

test('stopPostgresService classifies access denied', async () => {
  const result = await stopPostgresService('postgresql-x64-17', {
    platform: 'win32',
    runCommand: async () => ({
      code: 1,
      ok: false,
      stderr: 'Access is denied.',
      stdout: '',
      timedOut: false,
    }),
  });

  assertOperationResult(result, { ok: false });
  assert.equal(result.code, 'POSTGRES_SERVICE_STOP_ACCESS_DENIED');
});

test('stopPostgresService reports generic command failure with diagnostics', async () => {
  const result = await stopPostgresService('postgresql-x64-17', {
    platform: 'win32',
    runCommand: async () => ({
      code: 1,
      ok: false,
      stderr: 'stop failed',
      stdout: 'service output',
      timedOut: false,
    }),
  });

  assertOperationResult(result, { ok: false });
  assert.equal(result.code, 'POSTGRES_SERVICE_STOP_FAILED');
  assert.deepEqual(result.details, {
    code: 1,
    stderr: 'stop failed',
    stdout: 'service output',
    timedOut: false,
  });
});

for (const [name, operation, expectedCode] of [
  ['start', startPostgresService, 'POSTGRES_SERVICE_START_TIMEOUT'],
  ['stop', stopPostgresService, 'POSTGRES_SERVICE_STOP_TIMEOUT'],
]) {
  test(`${name}PostgresService reports timeout separately`, async () => {
    const result = await operation('postgresql-x64-17', {
      platform: 'win32',
      runCommand: async () => ({
        code: null,
        ok: false,
        stderr: 'partial error',
        stdout: 'partial output',
        timedOut: true,
      }),
    });

    assertOperationResult(result, { ok: false });
    assert.equal(result.code, expectedCode);
    assert.deepEqual(result.details, {
      code: null,
      stderr: 'partial error',
      stdout: 'partial output',
      timedOut: true,
    });
  });
}

for (const [name, operation, expectedCode] of [
  ['getPostgresServiceState', getPostgresServiceState, 'POSTGRES_SERVICE_CHECK_FAILED'],
  ['startPostgresService', startPostgresService, 'POSTGRES_SERVICE_START_FAILED'],
  ['stopPostgresService', stopPostgresService, 'POSTGRES_SERVICE_STOP_FAILED'],
]) {
  test(`${name} maps command runner rejection to OperationResult`, async () => {
    const result = await operation('postgresql-x64-17', {
      platform: 'win32',
      runCommand: async () => {
        throw new Error(`spawn failed password=hunter2 ${SECRET_MARKERS[0]}`);
      },
    });

    assertOperationResult(result, { ok: false });
    assert.equal(result.code, expectedCode);
    assert.equal(result.details.error.includes('hunter2'), false);
    assertNoSecretLeak(result);
  });

  test(`${name} redacts command failure diagnostics`, async () => {
    const result = await operation('postgresql-x64-17', {
      platform: 'win32',
      runCommand: async () => ({
        code: 1,
        ok: false,
        stderr: `stderr DATABASE_PASSWORD="very secret value" ${SECRET_MARKERS[0]}`,
        stdout: 'stdout database_url=postgresql://user:pass@host/db',
        timedOut: false,
      }),
    });

    assertOperationResult(result, { ok: false });
    assert.equal(result.details.stderr.includes('very secret value'), false);
    assert.equal(result.details.stdout.includes('postgresql://user:pass@host/db'), false);
    assertNoSecretLeak(result);
  });
}

for (const [name, operation] of [
  ['getPostgresServiceState', getPostgresServiceState],
  ['startPostgresService', startPostgresService],
  ['stopPostgresService', stopPostgresService],
]) {
  test(`${name} rejects non-Windows platforms without running commands`, async () => {
    let called = false;

    const result = await operation('postgresql-x64-17', {
      platform: 'linux',
      runCommand: async () => {
        called = true;
      },
    });

    assertOperationResult(result, { ok: false });
    assert.equal(result.code, 'POSTGRES_SERVICE_OPERATION_UNAVAILABLE');
    assert.equal(called, false);
  });

  test(`${name} requires a service name without running commands`, async () => {
    let called = false;

    const result = await operation('', {
      platform: 'win32',
      runCommand: async () => {
        called = true;
      },
    });

    assertOperationResult(result, { ok: false });
    assert.equal(result.code, 'POSTGRES_SERVICE_NAME_MISSING');
    assert.equal(called, false);
  });
}

test('isWindowsAccessDenied detects English and Russian service errors', () => {
  assert.equal(
    isWindowsAccessDenied({
      code: 1,
      stderr: 'Access is denied.',
      stdout: '',
    }),
    true,
  );
  assert.equal(
    isWindowsAccessDenied({
      code: 1,
      stderr: '',
      stdout: 'ОТКАЗАНО В ДОСТУПЕ',
    }),
    true,
  );
  assert.equal(
    isWindowsAccessDenied({
      code: 1,
      stderr: 'The specified service does not exist.',
      stdout: '',
    }),
    false,
  );
  assert.equal(
    isWindowsAccessDenied({
      code: 0,
      stderr: '',
      stdout: 'STATE : 4 RUNNING',
    }),
    false,
  );
});
