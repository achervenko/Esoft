import assert from 'node:assert/strict';
import test from 'node:test';

import { killPosixProcessGroup } from '../../../../scripts/infrastructure/commands/terminate-process.mjs';

test('killPosixProcessGroup targets the process group', () => {
  const calls = withMockedProcessKill(() => {
    const result = killPosixProcessGroup(123, 'SIGKILL');

    assert.equal(result, true);
  });

  assert.deepEqual(calls, [{ pid: -123, signal: 'SIGKILL' }]);
});

test('killPosixProcessGroup treats missing process group as not delivered', () => {
  const calls = withMockedProcessKill(() => {
    const result = killPosixProcessGroup(123, 'SIGKILL');

    assert.equal(result, false);
  }, {
    errorCode: 'ESRCH',
  });

  assert.deepEqual(calls, [{ pid: -123, signal: 'SIGKILL' }]);
});

test('killPosixProcessGroup propagates unexpected kill errors', () => {
  assert.throws(
    () =>
      withMockedProcessKill(
        () => killPosixProcessGroup(123, 'SIGKILL'),
        { errorCode: 'EPERM' },
      ),
    /mock kill failure/,
  );
});

function withMockedProcessKill(callback, { errorCode = null } = {}) {
  const originalKill = process.kill;
  const calls = [];

  process.kill = (pid, signal) => {
    calls.push({ pid, signal });

    if (errorCode) {
      const error = new Error('mock kill failure');
      error.code = errorCode;
      throw error;
    }

    return true;
  };

  try {
    callback();
  } finally {
    process.kill = originalKill;
  }

  return calls;
}
