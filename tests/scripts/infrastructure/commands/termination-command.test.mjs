import assert from 'node:assert/strict';
import test from 'node:test';

import { runTerminationCommand } from '../../../../scripts/infrastructure/commands/termination-command.mjs';

test('runTerminationCommand validates timeoutMs', () => {
  for (const timeoutMs of [Infinity, NaN, -1, '100']) {
    assert.throws(
      () => runTerminationCommand(process.execPath, [], timeoutMs),
      {
        name: 'TypeError',
        message: 'timeoutMs must be a non-negative finite number',
      },
    );
  }
});

test('runTerminationCommand reports timeout even when the process closes', async () => {
  const result = await runTerminationCommand(
    process.execPath,
    [
      '-e',
      "setInterval(() => process.stderr.write('taskkill diagnostic\\n'), 10); setTimeout(() => process.exit(0), 2000)",
    ],
    500,
  );

  assert.equal(result.ok, false);
  assert.match(result.message, /taskkill diagnostic/);
  assert.match(result.message, /taskkill timed out/);
  assert.equal(result.timedOut, true);
  assert.equal(result.terminationFailed, undefined);
});
