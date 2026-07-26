import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import test from 'node:test';

import { createResourceRegistry } from '../../../../scripts/infrastructure/resources/resource-registry.mjs';

test('resource registry validates grace timeout options', () => {
  for (const [option, value] of [
    ['processKillGraceMs', Number.NaN],
    ['processKillGraceMs', Number.POSITIVE_INFINITY],
    ['processKillGraceMs', -1],
    ['processTermGraceMs', Number.NaN],
    ['processTermGraceMs', Number.POSITIVE_INFINITY],
    ['processTermGraceMs', -1],
  ]) {
    assert.throws(
      () =>
        createResourceRegistry({
          [option]: value,
        }),
      {
        message: `${option} must be a non-negative finite number`,
        name: 'TypeError',
      },
    );
  }
});

test('resource registry cleanup is idempotent', async () => {
  const child = createChildProcess();
  const signals = [];
  let groupRunning = true;
  const registry = createResourceRegistry({
    killProcess: (pid, signal) => {
      signals.push({ pid, signal });

      if (signal === 0 && !groupRunning) {
        const error = new Error('missing process group');
        error.code = 'ESRCH';
        throw error;
      }

      if (signal === 'SIGTERM') {
        queueMicrotask(() => {
          groupRunning = false;
          child.exitCode = 0;
          child.emit('exit', 0, null);
          child.emit('close', 0, null);
        });
      }
    },
    platform: 'linux',
  });

  registry.registerProcess({
    child,
    name: 'MinIO',
  });

  const first = await registry.cleanup();
  const second = await registry.cleanup();

  assert.equal(first, second);
  assert.equal(first.ok, true);
  assert.equal(signals[0].signal, 0);
  assert.equal(signals.some(({ signal }) => signal === 'SIGTERM'), true);
  assert.equal(signals.some(({ signal }) => signal === 'SIGKILL'), false);
});

test('resource registry rejects registrations after cleanup starts', async () => {
  const registry = createResourceRegistry();

  await registry.cleanup();

  assert.throws(
    () =>
      registry.registerProcess({
        child: createChildProcess(),
        name: 'MinIO',
      }),
    {
      message: 'Cannot register a resource after cleanup has started',
      name: 'Error',
    },
  );
});

test('resource registry treats process without pid and spawn error as cleaned up', async () => {
  const child = createChildProcess({ pid: null });
  const registry = createResourceRegistry({
    killProcess: () => {
      throw new Error('unexpected kill');
    },
    platform: 'linux',
  });

  registry.registerProcess({
    child,
    name: 'MinIO',
  });
  child.emit('error', new Error('spawn failed'));

  const cleanup = await registry.cleanup();

  assert.equal(cleanup.ok, true);
  assert.equal(cleanup.cleanupErrors, 0);
});

test('resource registry reports cleanup failure when process does not close', async () => {
  const child = createChildProcess();
  const registry = createResourceRegistry({
    killProcess: () => undefined,
    platform: 'linux',
    processKillGraceMs: 1,
    processTermGraceMs: 1,
  });

  registry.registerProcess({
    child,
    name: 'MinIO',
  });

  const cleanup = await registry.cleanup();

  assert.equal(cleanup.ok, false);
  assert.equal(cleanup.cleanupErrors, 1);
  assert.equal(cleanup.results[0].name, 'MinIO');
});

test('resource registry does not treat exit as process tree cleanup on POSIX', async () => {
  const child = createChildProcess();
  const signals = [];
  let groupRunning = true;
  const registry = createResourceRegistry({
    killProcess: (pid, signal) => {
      signals.push({ pid, signal });

      if (signal === 'SIGKILL') {
        queueMicrotask(() => {
          groupRunning = false;
          child.emit('close', null, 'SIGKILL');
        });
      }

      if (signal === 0 && !groupRunning) {
        const error = new Error('missing process group');
        error.code = 'ESRCH';
        throw error;
      }
    },
    platform: 'linux',
    processKillGraceMs: 10,
    processTermGraceMs: 1,
  });

  registry.registerProcess({
    child,
    name: 'MinIO',
  });
  child.exitCode = 0;
  child.emit('exit', 0, null);

  const cleanup = await registry.cleanup();

  assert.equal(cleanup.ok, true);
  assert.equal(signals[0].signal, 0);
  assert.equal(signals.some(({ signal }) => signal === 'SIGTERM'), true);
  assert.equal(signals.some(({ signal }) => signal === 'SIGKILL'), true);
  assert.equal(
    signals.findIndex(({ signal }) => signal === 'SIGTERM') <
      signals.findIndex(({ signal }) => signal === 'SIGKILL'),
    true,
  );
});

test('resource registry reports POSIX cleanup failure when process group survives SIGKILL', async () => {
  const child = createChildProcess();
  const registry = createResourceRegistry({
    killProcess: () => undefined,
    platform: 'linux',
    processKillGraceMs: 1,
    processTermGraceMs: 1,
  });

  registry.registerProcess({
    child,
    name: 'MinIO',
  });
  child.emit('close', 0, null);

  const cleanup = await registry.cleanup();

  assert.equal(cleanup.ok, false);
  assert.equal(cleanup.results[0].result.message, 'Process tree did not close after SIGKILL');
});

test('resource registry uses taskkill on Windows', async () => {
  const child = createChildProcess();
  const calls = [];
  const registry = createResourceRegistry({
    platform: 'win32',
    runCommand: async (...args) => {
      calls.push(args);
      queueMicrotask(() => {
        child.exitCode = null;
        child.signalCode = 'SIGTERM';
        child.emit('exit', null, 'SIGTERM');
        child.emit('close', null, 'SIGTERM');
      });
      return { ok: true };
    },
  });

  registry.registerProcess({
    child,
    name: 'MinIO',
  });

  const cleanup = await registry.cleanup();

  assert.equal(cleanup.ok, true);
  assert.deepEqual(calls, [
    ['taskkill.exe', ['/pid', '12345', '/t', '/f']],
  ]);
});

test('resource registry uses taskkill on Windows even when parent already closed', async () => {
  const child = createChildProcess();
  const calls = [];
  const registry = createResourceRegistry({
    platform: 'win32',
    runCommand: async (...args) => {
      calls.push(args);
      return { ok: true };
    },
  });

  registry.registerProcess({
    child,
    name: 'MinIO',
  });
  child.emit('close', 0, null);

  const cleanup = await registry.cleanup();

  assert.equal(cleanup.ok, true);
  assert.deepEqual(calls, [
    ['taskkill.exe', ['/pid', '12345', '/t', '/f']],
  ]);
});

test('resource registry continues cleaning resources after one cleanup rejects', async () => {
  const first = createChildProcess({ pid: 111 });
  const second = createChildProcess({ pid: 222 });
  const calls = [];
  const registry = createResourceRegistry({
    platform: 'win32',
    processKillGraceMs: 1,
    runCommand: async (_command, args) => {
      calls.push(args[1]);

      if (args[1] === '222') {
        throw new Error('taskkill crashed');
      }

      queueMicrotask(() => {
        first.emit('close', null, 'SIGTERM');
      });
      return { ok: true };
    },
  });

  registry.registerProcess({
    child: first,
    name: 'first',
  });
  registry.registerProcess({
    child: second,
    name: 'second',
  });

  const cleanup = await registry.cleanup();

  assert.equal(cleanup.ok, false);
  assert.equal(cleanup.cleanupErrors, 1);
  assert.deepEqual(calls, ['222', '111']);
  assert.equal(cleanup.results[0].name, 'second');
  assert.equal(
    cleanup.results[0].result.message,
    'Unable to clean up resource: taskkill crashed',
  );
  assert.equal(cleanup.results[1].name, 'first');
  assert.equal(cleanup.results[1].result.ok, true);
});

test('resource registry reports unsuccessful taskkill result', async () => {
  const child = createChildProcess();
  const registry = createResourceRegistry({
    platform: 'win32',
    runCommand: async () => {
      queueMicrotask(() => {
        child.emit('close', null, 'SIGTERM');
      });

      return {
        code: 1,
        message: 'taskkill failed',
        ok: false,
      };
    },
  });

  registry.registerProcess({
    child,
    name: 'MinIO',
  });

  const cleanup = await registry.cleanup();

  assert.equal(cleanup.ok, false);
  assert.equal(cleanup.cleanupErrors, 1);
  assert.equal(cleanup.results[0].name, 'MinIO');
});

test('resource registry treats missing POSIX process group as already cleaned up', async () => {
  const child = createChildProcess();
  const signals = [];
  const registry = createResourceRegistry({
    killProcess: (pid, signal) => {
      signals.push({ pid, signal });

      const error = new Error('missing process group');
      error.code = 'ESRCH';
      throw error;
    },
    platform: 'linux',
  });

  registry.registerProcess({
    child,
    name: 'MinIO',
  });

  const cleanup = await registry.cleanup();

  assert.equal(cleanup.ok, true);
  assert.deepEqual(signals, [{ pid: -12345, signal: 0 }]);
});

function createChildProcess({ pid = 12345 } = {}) {
  const child = new EventEmitter();
  child.exitCode = null;
  child.pid = pid;
  child.signalCode = null;
  return child;
}
