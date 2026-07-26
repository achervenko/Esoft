import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import test from 'node:test';

import { installShutdownHandlers } from '../../../scripts/doctor/doctor.mjs';

test('shutdown signal handlers stay installed and ignore repeated signals during finalization', async () => {
  const processImpl = new EventEmitter();
  const finalizeCalls = [];
  let interrupted = 0;
  let resolveFinalize;

  const removeHandlers = installShutdownHandlers({
    finalizeOnce: (exitCode, error = null) => {
      finalizeCalls.push({ error, exitCode });

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
  processImpl.emit('SIGINT');
  processImpl.emit('SIGTERM');

  await nextTick();

  assert.equal(interrupted, 1);
  assert.deepEqual(finalizeCalls, [{ error: null, exitCode: 130 }]);
  assert.equal(processImpl.listenerCount('SIGINT'), 1);
  assert.equal(processImpl.listenerCount('SIGTERM'), 1);
  assert.equal(processImpl.exitCode, undefined);

  resolveFinalize(130);
  await nextTick();

  assert.equal(processImpl.exitCode, 130);

  removeHandlers();

  assert.equal(processImpl.listenerCount('SIGINT'), 0);
  assert.equal(processImpl.listenerCount('SIGTERM'), 0);
});

test('shutdown handlers map finalization rejection to emergency exit code', async () => {
  const processImpl = new EventEmitter();

  installShutdownHandlers({
    finalizeOnce: () => Promise.reject(new Error('finalize failed')),
    processImpl,
    setInterrupted: () => undefined,
  });

  processImpl.emit('SIGTERM');
  await nextTick();

  assert.equal(processImpl.exitCode, 2);
});

test('fatal handlers begin shutdown and mark the workflow interrupted', async () => {
  const processImpl = new EventEmitter();
  const error = new Error('cleanup interrupted');
  const finalizeCalls = [];
  let interrupted = 0;

  installShutdownHandlers({
    finalizeOnce: (exitCode, reason = null) => {
      finalizeCalls.push({ exitCode, reason });
      return new Promise(() => undefined);
    },
    processImpl,
    setInterrupted: () => {
      interrupted += 1;
    },
  });

  processImpl.emit('uncaughtException', error);

  await nextTick();

  assert.equal(interrupted, 1);
  assert.deepEqual(finalizeCalls, [{ exitCode: 1, reason: error }]);
});

test('fatal handlers ignore additional fatal errors during finalization', async () => {
  const processImpl = new EventEmitter();
  const error = new Error('cleanup interrupted');
  const finalizeCalls = [];

  installShutdownHandlers({
    finalizeOnce: (exitCode, reason = null) => {
      finalizeCalls.push({ exitCode, reason });
      return new Promise(() => undefined);
    },
    processImpl,
    setInterrupted: () => undefined,
  });

  processImpl.emit('SIGINT');
  processImpl.emit('uncaughtException', error);
  processImpl.emit('unhandledRejection', new Error('rejection'));

  await nextTick();

  assert.deepEqual(finalizeCalls, [{ exitCode: 130, reason: null }]);
});

function nextTick() {
  return new Promise((resolve) => {
    setImmediate(resolve);
  });
}
