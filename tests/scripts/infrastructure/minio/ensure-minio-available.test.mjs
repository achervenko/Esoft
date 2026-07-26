import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import test from 'node:test';

import { ensureMinioAvailable } from '../../../../scripts/infrastructure/minio/ensure-minio-available.mjs';
import {
  assertNoSecretLeak,
  assertOperationResult,
} from '../../helpers/operation-result.mjs';

test('ensureMinioAvailable uses an already running MinIO without registering cleanup', async () => {
  let spawnCalled = false;
  const resources = createResources();
  const result = await ensureMinioAvailable({
    checkReadiness: async () => ({
      code: 'MINIO_READINESS_OK',
      message: 'ready',
      ok: true,
    }),
    config: createConfig(),
    resources,
    spawnProcess: () => {
      spawnCalled = true;
      throw new Error('unexpected spawn');
    },
  });

  assertOperationResult(result, { ok: true });
  assert.equal(result.code, 'MINIO_AVAILABLE');
  assert.deepEqual(result.details, { startedTemporarily: false });
  assert.equal(spawnCalled, false);
  assert.equal(resources.registered.length, 0);
});

test('ensureMinioAvailable registers temporary MinIO before spawn event and readiness', async () => {
  const child = createChildProcess();
  const resources = createResources();
  let readinessCalls = 0;
  let registeredBeforeSpawn = false;

  const result = await ensureMinioAvailable({
    checkReadiness: async () => {
      readinessCalls += 1;

      if (readinessCalls === 1) {
        return {
          code: 'MINIO_READINESS_FAILED',
          message: 'not ready',
          ok: false,
        };
      }

      assert.equal(resources.registered.length, 1);
      return {
        code: 'MINIO_READINESS_OK',
        message: 'ready',
        ok: true,
      };
    },
    config: createConfig(),
    checkPortsAvailable: async () => ({ ok: true }),
    resources,
    spawnProcess: () => {
      queueMicrotask(() => {
        registeredBeforeSpawn = resources.registered.length === 1;
        child.emit('spawn');
      });

      return child;
    },
  });

  assert.equal(registeredBeforeSpawn, true);
  assertOperationResult(result, { ok: true });
  assert.equal(result.code, 'MINIO_STARTED_TEMPORARILY');
  assert.deepEqual(result.details, { startedTemporarily: true });
});

test('ensureMinioAvailable does not spawn when MinIO ports are occupied', async () => {
  let spawnCalled = false;
  const result = await ensureMinioAvailable({
    checkReadiness: async () => ({
      code: 'MINIO_READINESS_FAILED',
      message: 'not ready',
      ok: false,
    }),
    config: createConfig(),
    checkPortsAvailable: async () => ({
      code: 'MINIO_PORT_CONFLICT',
      message: 'MinIO port is not available',
      ok: false,
    }),
    resources: createResources(),
    spawnProcess: () => {
      spawnCalled = true;
      throw new Error('unexpected spawn');
    },
  });

  assertOperationResult(result, { ok: false });
  assert.equal(result.code, 'MINIO_PORT_CONFLICT');
  assert.equal(spawnCalled, false);
});

test('ensureMinioAvailable maps readiness check exceptions to a result', async () => {
  const result = await ensureMinioAvailable({
    checkReadiness: async () => {
      throw new Error('readiness exploded MINIO_ROOT_PASSWORD=hunter2');
    },
    config: createConfig(),
    resources: createResources(),
  });

  assertOperationResult(result, { ok: false });
  assert.equal(result.code, 'MINIO_READINESS_FAILED');
  assertNoSecretLeak(result);
});

test('ensureMinioAvailable maps port check exceptions to a result', async () => {
  const result = await ensureMinioAvailable({
    checkReadiness: async () => ({
      code: 'MINIO_READINESS_FAILED',
      message: 'not ready',
      ok: false,
    }),
    checkPortsAvailable: async () => {
      throw new Error('port check exploded MINIO_ROOT_PASSWORD=hunter2');
    },
    config: createConfig(),
    resources: createResources(),
  });

  assertOperationResult(result, { ok: false });
  assert.equal(result.code, 'MINIO_PORT_CHECK_FAILED');
  assertNoSecretLeak(result);
});

test('ensureMinioAvailable reports spawn errors without leaking secrets', async () => {
  const result = await ensureMinioAvailable({
    checkReadiness: async () => ({
      code: 'MINIO_READINESS_FAILED',
      message: 'not ready',
      ok: false,
    }),
    config: createConfig(),
    checkPortsAvailable: async () => ({ ok: true }),
    resources: createResources(),
    spawnProcess: () => {
      throw new Error('spawn failed MINIO_ROOT_PASSWORD=hunter2');
    },
  });

  assertOperationResult(result, { ok: false });
  assert.equal(result.code, 'MINIO_START_FAILED');
  assertNoSecretLeak(result);
});

test('ensureMinioAvailable terminates MinIO when diagnostics initialization fails', async () => {
  const child = createChildProcess();
  Object.defineProperty(child, 'stderr', {
    get() {
      throw new Error('stderr failed MINIO_ROOT_PASSWORD=hunter2');
    },
  });
  let terminatedChild = null;

  const result = await ensureMinioAvailable({
    checkReadiness: async () => ({
      code: 'MINIO_READINESS_FAILED',
      message: 'not ready',
      ok: false,
    }),
    checkPortsAvailable: async () => ({ ok: true }),
    config: createConfig(),
    resources: createResources(),
    spawnProcess: () => child,
    terminateUnregisteredProcess: async (processToTerminate) => {
      terminatedChild = processToTerminate;
      return { ok: true };
    },
  });

  assert.equal(terminatedChild, child);
  assertOperationResult(result, { ok: false });
  assert.equal(result.code, 'MINIO_START_FAILED');
  assert.equal(result.message, 'Unable to initialize MinIO diagnostics');
  assertNoSecretLeak(result);
});

test('ensureMinioAvailable reports child process error after registration', async () => {
  const child = createChildProcess({ pid: undefined });
  const resources = createResources();
  const result = await ensureMinioAvailable({
    checkReadiness: async () => ({
      code: 'MINIO_READINESS_FAILED',
      message: 'not ready',
      ok: false,
    }),
    config: createConfig(),
    checkPortsAvailable: async () => ({ ok: true }),
    resources,
    spawnProcess: () => {
      queueMicrotask(() => {
        child.emit('error', new Error('ENOENT MINIO_SECRET_KEY=hunter2'));
      });

      return child;
    },
  });

  assert.equal(resources.registered.length, 1);
  assertOperationResult(result, { ok: false });
  assert.equal(result.code, 'MINIO_START_FAILED');
  assertNoSecretLeak(result);
});

test('ensureMinioAvailable terminates MinIO when cleanup registration fails', async () => {
  const child = createChildProcess();
  let terminatedChild = null;
  const result = await ensureMinioAvailable({
    checkReadiness: async () => ({
      code: 'MINIO_READINESS_FAILED',
      message: 'not ready',
      ok: false,
    }),
    checkPortsAvailable: async () => ({ ok: true }),
    config: createConfig(),
    resources: {
      registerProcess: () => {
        throw new Error('cleanup already started');
      },
    },
    spawnProcess: () => child,
    terminateUnregisteredProcess: async (processToTerminate) => {
      terminatedChild = processToTerminate;
      return { ok: true };
    },
  });

  assert.equal(terminatedChild, child);
  assertOperationResult(result, { ok: false });
  assert.equal(result.code, 'MINIO_START_FAILED');
  assert.equal(result.message, 'Unable to register MinIO cleanup');
});

test('ensureMinioAvailable reports cleanup rejection when registration fails', async () => {
  const child = createChildProcess();
  const result = await ensureMinioAvailable({
    checkReadiness: async () => ({
      code: 'MINIO_READINESS_FAILED',
      message: 'not ready',
      ok: false,
    }),
    checkPortsAvailable: async () => ({ ok: true }),
    config: createConfig(),
    resources: {
      registerProcess: () => {
        throw new Error('cleanup already started MINIO_ROOT_PASSWORD=hunter2');
      },
    },
    spawnProcess: () => child,
    terminateUnregisteredProcess: async () => {
      throw new Error('termination rejected MINIO_ROOT_PASSWORD=hunter2');
    },
  });

  assertOperationResult(result, { ok: false });
  assert.equal(result.code, 'MINIO_START_FAILED');
  assert.equal(result.details.cleanupFailed, true);
  assertNoSecretLeak(result);
});

test('ensureMinioAvailable reports early exit before readiness', async () => {
  const child = createChildProcess();
  const result = await ensureMinioAvailable({
    checkReadiness: async () => ({
      code: 'MINIO_READINESS_FAILED',
      message: 'not ready',
      ok: false,
    }),
    config: createConfig(),
    checkPortsAvailable: async () => ({ ok: true }),
    resources: createResources(),
    spawnProcess: () => {
      queueMicrotask(() => {
        child.emit('spawn');
        child.exitCode = 1;
        child.emit('exit', 1, null);
      });

      return child;
    },
  });

  assertOperationResult(result, { ok: false });
  assert.equal(result.code, 'MINIO_EXITED_BEFORE_READY');
});

test('ensureMinioAvailable redacts and limits temporary MinIO stderr diagnostics', async () => {
  const child = createChildProcess();
  const result = await ensureMinioAvailable({
    checkReadiness: async () => ({
      code: 'MINIO_READINESS_FAILED',
      message: 'not ready',
      ok: false,
    }),
    config: createConfig({
      accessKey: 'app-access',
      rootPassword: 'hunter2',
      rootUser: 'esoft',
      secretKey: 'app-secret',
    }),
    checkPortsAvailable: async () => ({ ok: true }),
    readinessTimeoutMs: 5,
    resources: createResources(),
    spawnProcess: () => {
      queueMicrotask(() => {
        child.emit('spawn');
        child.stderr.emit(
          'data',
          `${'x'.repeat(70 * 1024)} MINIO_ROOT_PASSWORD=hunter2 esoft app-access app-secret`,
        );
      });

      return child;
    },
  });

  assertOperationResult(result, { ok: false });
  assert.equal(result.code, 'MINIO_READINESS_TIMEOUT');
  assert.equal(result.details.stderr.includes('hunter2'), false);
  assert.equal(result.details.stderr.includes('esoft'), false);
  assert.equal(result.details.stderr.includes('app-access'), false);
  assert.equal(result.details.stderr.includes('app-secret'), false);
  assert.equal(result.details.stderr.length <= 64 * 1024, true);
  assertNoSecretLeak(result);
});

test('ensureMinioAvailable returns readiness timeout without local cleanup', async () => {
  const child = createChildProcess();
  const resources = createResources();
  const result = await ensureMinioAvailable({
    checkReadiness: async () => ({
      code: 'MINIO_READINESS_FAILED',
      message: 'not ready',
      ok: false,
    }),
    config: createConfig(),
    checkPortsAvailable: async () => ({ ok: true }),
    readinessTimeoutMs: 5,
    resources,
    spawnProcess: () => {
      queueMicrotask(() => {
        child.emit('spawn');
      });

      return child;
    },
  });

  assertOperationResult(result, { ok: false });
  assert.equal(result.code, 'MINIO_READINESS_TIMEOUT');
  assert.equal(resources.cleanupCalls, 0);
});

test('ensureMinioAvailable validates readiness timeout before side effects', async () => {
  let mkdirCalled = false;
  let spawnCalled = false;

  await assert.rejects(
    () =>
      ensureMinioAvailable({
        checkReadiness: async () => {
          throw new Error('unexpected readiness');
        },
        config: createConfig(),
        mkdirImpl: async () => {
          mkdirCalled = true;
        },
        readinessTimeoutMs: Number.NaN,
        resources: createResources(),
        spawnProcess: () => {
          spawnCalled = true;
          return createChildProcess();
        },
      }),
    {
      message: 'readinessTimeoutMs must be a positive finite number',
      name: 'TypeError',
    },
  );

  assert.equal(mkdirCalled, false);
  assert.equal(spawnCalled, false);
});
function createConfig(minioOverrides = {}) {
  return {
    minio: {
      accessKey: undefined,
      consolePort: 9001,
      dataDir: 'C:/MinIO/data',
      executable: 'C:/MinIO/minio.exe',
      host: '127.0.0.1',
      port: 9000,
      rootPassword: 'hunter2',
      rootUser: 'esoft',
      secretKey: undefined,
      ...minioOverrides,
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

function createResources() {
  return {
    cleanupCalls: 0,
    registered: [],
    cleanup() {
      this.cleanupCalls += 1;
      return { cleanupErrors: 0, ok: true, results: [] };
    },
    registerProcess(resource) {
      let closeResolve;
      const closePromise = new Promise((resolveClose) => {
        closeResolve = resolveClose;
      });

      resource.child.once('exit', (code, signal) => {
        closeResolve({ code, signal });
      });
      resource.child.once('close', (code, signal) => {
        closeResolve({ code, signal });
      });
      resource.child.once('error', () => {
        closeResolve({ code: null, signal: null });
      });

      this.registered.push(resource);
      return {
        closePromise,
      };
    },
  };
}
