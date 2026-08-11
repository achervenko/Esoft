import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import test from 'node:test';

import { stopManagedProcess } from '../../../scripts/doctor/process-stop.mjs';

test('stopManagedProcess stops a POSIX process group after the leader exited', async () => {
  const signals = [];
  let groupRunning = true;

  const stopped = await stopManagedProcess(
    {
      child: {
        exitCode: 0,
        pid: 12345,
        signalCode: null,
      },
      name: 'backend',
      ports: [],
    },
    {
      groupPollIntervalMs: 1,
      killGraceMs: 0,
      killProcess: (pid, signal) => {
        assert.equal(pid, -12345);

        if (signal === 0) {
          if (!groupRunning) {
            const error = new Error('missing');
            error.code = 'ESRCH';
            throw error;
          }

          return;
        }

        signals.push(signal);

        if (signal === 'SIGKILL') {
          groupRunning = false;
        }
      },
      platform: 'linux',
      terminationGraceMs: 0,
    },
  );

  assert.equal(stopped, true);
  assert.deepEqual(signals, ['SIGTERM', 'SIGKILL']);
});

test('stopManagedProcess uses taskkill for Windows process trees', async () => {
  const calls = [];
  const child = new EventEmitter();
  child.exitCode = null;
  child.pid = 12345;
  child.signalCode = null;

  const stopped = await stopManagedProcess(
    {
      child,
      name: 'backend',
      ports: [],
    },
    {
      platform: 'win32',
      runCommand: async (command, args, options) => {
        calls.push({ args, command, options });
        queueMicrotask(() => {
          child.exitCode = 1;
          child.emit('exit', 1, null);
        });
        return { ok: true };
      },
    },
  );

  assert.equal(stopped, true);
  assert.deepEqual(calls, [
    {
      args: ['/pid', '12345', '/t', '/f'],
      command: 'taskkill.exe',
      options: {
        timeoutMs: 10_000,
      },
    },
  ]);
});

test('stopManagedProcess reports Windows taskkill success as failure when process remains running', async () => {
  const child = new EventEmitter();
  child.exitCode = null;
  child.pid = 12345;
  child.signalCode = null;

  const stopped = await stopManagedProcess(
    {
      child,
      name: 'backend',
      ports: [],
    },
    {
      platform: 'win32',
      runCommand: async () => ({ ok: true }),
      waitForExit: async () => false,
    },
  );

  assert.equal(stopped, false);
});

test('stopManagedProcess reports Windows taskkill failure when process remains running', async () => {
  const child = new EventEmitter();
  child.exitCode = null;
  child.pid = 12345;
  child.signalCode = null;

  const stopped = await stopManagedProcess(
    {
      child,
      name: 'backend',
      ports: [],
    },
    {
      platform: 'win32',
      runCommand: async () => ({ ok: false }),
      waitForExit: async () => false,
    },
  );

  assert.equal(stopped, false);
});
