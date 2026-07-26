import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import test from 'node:test';

import { installSetupShutdownHandlers } from '../../../scripts/setup/setup.mjs';

test('setup shutdown handlers run finalizer once for repeated signals', async () => {
  const processImpl = new EventEmitter();
  const finalizeCalls = [];
  let interrupted = 0;
  let resolveFinalize;

  const removeHandlers = installSetupShutdownHandlers({
    finalizeOnce: (exitCode) => {
      finalizeCalls.push(exitCode);
      return new Promise((resolve) => {
        resolveFinalize = resolve;
      });
    },
    processImpl,
    setInterrupted: () => {
      interrupted += 1;
    },
  });

  processImpl.emit('SIGINT');
  processImpl.emit('SIGTERM');
  processImpl.emit('SIGINT');

  await nextTick();

  assert.equal(interrupted, 1);
  assert.deepEqual(finalizeCalls, [130]);
  assert.equal(processImpl.listenerCount('SIGINT'), 1);
  assert.equal(processImpl.exitCode, undefined);

  resolveFinalize(130);
  await nextTick();

  assert.equal(processImpl.exitCode, 130);

  removeHandlers();

  assert.equal(processImpl.listenerCount('SIGINT'), 0);
  assert.equal(processImpl.listenerCount('SIGTERM'), 0);
  assert.equal(processImpl.listenerCount('uncaughtException'), 0);
  assert.equal(processImpl.listenerCount('unhandledRejection'), 0);

  processImpl.emit('SIGINT');
  processImpl.emit('SIGTERM');
  processImpl.emit('uncaughtException', new Error('late error'));
  processImpl.emit('unhandledRejection', new Error('late rejection'));
  await nextTick();

  assert.equal(interrupted, 1);
  assert.deepEqual(finalizeCalls, [130]);
});

test('setup fatal handlers mark interruption and preserve cleanup failure exit code', async () => {
  const processImpl = new EventEmitter();
  const error = new Error('fatal setup error');
  const interruptions = [];

  installSetupShutdownHandlers({
    finalizeOnce: async (exitCode) => {
      assert.equal(exitCode, 1);
      return 2;
    },
    processImpl,
    setInterrupted: (reason, exitCode) => {
      interruptions.push({ exitCode, reason });
    },
  });

  processImpl.emit('uncaughtException', error);
  await nextTick();

  assert.deepEqual(interruptions, [{ exitCode: 1, reason: error }]);
  assert.equal(processImpl.exitCode, 2);
});

test('setup shutdown handlers map finalizer rejection to cleanup failure exit code', async () => {
  const processImpl = new EventEmitter();

  installSetupShutdownHandlers({
    finalizeOnce: async () => {
      throw new Error('cleanup crashed');
    },
    processImpl,
    setInterrupted: () => undefined,
  });

  processImpl.emit('unhandledRejection', new Error('rejection'));
  await nextTick();

  assert.equal(processImpl.exitCode, 2);
});

function nextTick() {
  return new Promise((resolve) => {
    setImmediate(resolve);
  });
}
