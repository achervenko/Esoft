import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import test from 'node:test';

import { waitForExit } from '../../../scripts/doctor/process-wait.mjs';

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
