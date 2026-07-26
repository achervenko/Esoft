import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import test from 'node:test';

import {
  formatExit,
  spawnMinio,
  terminateUnregisteredMinioProcess,
  waitForSpawn,
  waitForTemporaryMinioReadiness,
} from '../../../../scripts/infrastructure/minio/minio-process.mjs';

test('spawnMinio starts MinIO with expected command, args and environment', () => {
  const calls = [];
  const child = createChildProcess();
  const result = spawnMinio({
    config: createConfig(),
    platform: 'linux',
    spawnImpl: (...args) => {
      calls.push(args);
      return child;
    },
  });

  assert.equal(result, child);
  assert.equal(calls[0][0], 'C:/MinIO/minio.exe');
  assert.deepEqual(calls[0][1], [
    'server',
    'C:/MinIO/data',
    '--address',
    '127.0.0.1:9000',
    '--console-address',
    '127.0.0.1:9001',
  ]);
  assert.equal(calls[0][2].detached, true);
  assert.equal(calls[0][2].env.MINIO_ROOT_USER, 'esoft');
  assert.equal(calls[0][2].env.MINIO_ROOT_PASSWORD, 'hunter2');
  assert.deepEqual(calls[0][2].stdio, ['ignore', 'ignore', 'pipe']);
});

test('spawnMinio formats IPv6 host addresses for MinIO arguments', () => {
  const calls = [];
  spawnMinio({
    config: createConfig({
      host: '::1',
    }),
    platform: 'linux',
    spawnImpl: (...args) => {
      calls.push(args);
      return createChildProcess();
    },
  });

  assert.deepEqual(calls[0][1], [
    'server',
    'C:/MinIO/data',
    '--address',
    '[::1]:9000',
    '--console-address',
    '[::1]:9001',
  ]);
});

test('waitForSpawn resolves after spawn event', async () => {
  const child = createChildProcess({ pid: undefined });
  const wait = waitForSpawn(child);

  child.pid = 12345;
  child.emit('spawn');

  assert.deepEqual(await wait, { ok: true });
});

test('waitForSpawn resolves when spawn was already observed through pid', async () => {
  const child = createChildProcess({ pid: 12345 });

  assert.deepEqual(await waitForSpawn(child), { ok: true });
});

test('waitForSpawn reports process error', async () => {
  const child = createChildProcess({ pid: undefined });
  const wait = waitForSpawn(child);
  const error = new Error('spawn failed');

  child.emit('error', error);

  assert.deepEqual(await wait, { error, ok: false });
});

test('waitForSpawn reports early exit', async () => {
  const child = createChildProcess({ pid: undefined });
  const wait = waitForSpawn(child);

  child.emit('exit', 7, null);

  const result = await wait;

  assert.equal(result.ok, false);
  assert.equal(result.error.message, 'MinIO exited before startup completed with code 7');
});

test('waitForSpawn reports an exit that happened before listeners completed', async () => {
  const child = createChildProcess({ pid: undefined });
  child.exitCode = 7;

  const result = await waitForSpawn(child);

  assert.equal(result.ok, false);
  assert.equal(result.error.message, 'MinIO exited before startup completed with code 7');
});

test('waitForTemporaryMinioReadiness resolves when readiness succeeds', async () => {
  const closePromise = new Promise(() => undefined);
  const result = await waitForTemporaryMinioReadiness({
    checkReadiness: async () => ({
      code: 'MINIO_READINESS_OK',
      message: 'ready',
      ok: true,
    }),
    closePromise,
    config: createConfig(),
    readinessTimeoutMs: 100,
  });

  assert.deepEqual(result, {
    result: {
      code: 'MINIO_READINESS_OK',
      message: 'ready',
      ok: true,
    },
  });
});

test('waitForTemporaryMinioReadiness resolves when child closes first', async () => {
  const result = await waitForTemporaryMinioReadiness({
    checkReadiness: async () => new Promise(() => undefined),
    closePromise: Promise.resolve({ code: 1, signal: null }),
    config: createConfig(),
    readinessTimeoutMs: 100,
  });

  assert.deepEqual(result, {
    closed: true,
    code: 1,
    signal: null,
  });
});

test('waitForTemporaryMinioReadiness reports readiness timeout', async () => {
  const result = await waitForTemporaryMinioReadiness({
    checkReadiness: async () => new Promise(() => undefined),
    closePromise: new Promise(() => undefined),
    config: createConfig(),
    readinessTimeoutMs: 10,
  });

  assert.equal(result.result.ok, false);
  assert.equal(result.result.code, 'MINIO_READINESS_TIMEOUT');
});

test('terminateUnregisteredMinioProcess stops a POSIX process group', async () => {
  const child = createChildProcess({ pid: 12345 });
  const signals = [];
  let groupRunning = true;
  const result = await terminateUnregisteredMinioProcess(
    child,
    {
      killProcess: (pid, signal) => {
        signals.push({ pid, signal });

        if (signal === 'SIGKILL') {
          groupRunning = false;
        }

        if (signal === 0 && !groupRunning) {
          const error = new Error('missing');
          error.code = 'ESRCH';
          throw error;
        }
      },
      platform: 'linux',
    },
  );

  assert.equal(result.ok, true);
  assert.deepEqual(signals, [
    { pid: -12345, signal: 'SIGKILL' },
    { pid: -12345, signal: 0 },
  ]);
});

test('terminateUnregisteredMinioProcess stops a Windows process tree', async () => {
  const child = createChildProcess({ pid: 12345 });
  const commands = [];
  const signals = [];
  const result = await terminateUnregisteredMinioProcess(
    child,
    {
      killProcess: (...args) => {
        signals.push(args);
      },
      platform: 'win32',
      runCommand: async (...args) => {
        commands.push(args);
        queueMicrotask(() => {
          child.exitCode = 0;
          child.emit('close', 0, null);
        });
        return { ok: true };
      },
      timeoutMs: 50,
    },
  );

  assert.equal(result.ok, true);
  assert.deepEqual(commands, [
    ['taskkill.exe', ['/pid', '12345', '/t', '/f']],
  ]);
  assert.deepEqual(signals, []);
});

test('terminateUnregisteredMinioProcess reports Windows termination failure', async () => {
  const result = await terminateUnregisteredMinioProcess(
    createChildProcess({ pid: 12345 }),
    {
      killProcess: () => {
        throw new Error('unexpected POSIX signal');
      },
      platform: 'win32',
      runCommand: async () => ({
        message: 'taskkill failed',
        ok: false,
      }),
      timeoutMs: 5,
    },
  );

  assert.equal(result.ok, false);
  assert.equal(
    result.message,
    'Unable to terminate unregistered MinIO process: taskkill failed',
  );
});

test('terminateUnregisteredMinioProcess reports cleanup exceptions', async () => {
  const result = await terminateUnregisteredMinioProcess(
    createChildProcess({ pid: 12345 }),
    {
      killProcess: () => {
        throw new Error('cleanup failed');
      },
      platform: 'linux',
    },
  );

  assert.equal(result.ok, false);
  assert.equal(
    result.message,
    'Unable to terminate unregistered MinIO process tree: cleanup failed',
  );
});

test('terminateUnregisteredMinioProcess validates timeoutMs', async () => {
  const result = await terminateUnregisteredMinioProcess(
    createChildProcess({ pid: 12345 }),
    {
      platform: 'linux',
      timeoutMs: Number.POSITIVE_INFINITY,
    },
  );

  assert.equal(result.ok, false);
  assert.equal(
    result.message,
    'Unable to terminate unregistered MinIO process: timeoutMs must be a positive finite number',
  );
});

test('formatExit formats code, signal and unknown exits', () => {
  assert.equal(formatExit('exited', 1, null), 'exited with code 1');
  assert.equal(formatExit('exited', null, 'SIGTERM'), 'exited with signal SIGTERM');
  assert.equal(formatExit('exited', null, null), 'exited');
});

function createConfig(overrides = {}) {
  return {
    minio: {
      consolePort: 9001,
      dataDir: 'C:/MinIO/data',
      executable: 'C:/MinIO/minio.exe',
      host: '127.0.0.1',
      port: 9000,
      rootPassword: 'hunter2',
      rootUser: 'esoft',
      ...overrides,
    },
  };
}

function createChildProcess(options = {}) {
  const pid = Object.hasOwn(options, 'pid') ? options.pid : 12345;
  const child = new EventEmitter();
  child.exitCode = null;
  child.pid = pid;
  child.signalCode = null;
  child.stderr = new EventEmitter();
  return child;
}
