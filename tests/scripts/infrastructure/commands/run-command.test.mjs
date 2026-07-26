import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { runCommand } from '../../../../scripts/infrastructure/commands/run-command.mjs';
import { createTemporaryProject } from '../../helpers/temporary-project.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixtures = resolve(__dirname, '../../fixtures/child-processes');

test('runCommand captures a successful command', async () => {
  const result = await runCommand(process.execPath, [
    resolve(fixtures, 'exit-zero.mjs'),
  ]);

  assert.equal(result.ok, true);
  assert.equal(result.code, 0);
  assert.equal(result.stdout, '');
  assert.equal(result.stderr, '');
  assert.equal(result.timedOut, false);
});

test('runCommand captures non-zero exit code', async () => {
  const result = await runCommand(process.execPath, [
    resolve(fixtures, 'exit-one.mjs'),
  ]);

  assert.equal(result.ok, false);
  assert.equal(result.code, 1);
  assert.equal(result.timedOut, false);
});

test('runCommand captures stdout, stderr and custom env', async () => {
  const envResult = await runCommand(process.execPath, [
    resolve(fixtures, 'print-env.mjs'),
  ], {
    env: {
      ...process.env,
      ESOFT_TEST_ENV_VALUE: 'visible-to-child',
    },
  });
  const outputResult = await runCommand(process.execPath, [
    resolve(fixtures, 'write-stdout-stderr.mjs'),
  ]);

  assert.equal(envResult.stdout, 'visible-to-child');
  assert.equal(outputResult.stdout, 'stdout message');
  assert.equal(outputResult.stderr, 'stderr message');
});

test('runCommand preserves cwd and argument boundaries', async () => {
  const project = await createTemporaryProject();

  try {
    const result = await runCommand(
      process.execPath,
      [
        resolve(fixtures, 'print-context.mjs'),
        'value with spaces',
        '--flag=value',
      ],
      {
        cwd: project.root,
      },
    );

    assert.equal(result.ok, true);
    assert.deepEqual(JSON.parse(result.stdout), {
      args: ['value with spaces', '--flag=value'],
      cwd: project.root,
    });
  } finally {
    await project.remove();
  }
});

test('runCommand returns a failed result for missing executable', async () => {
  const result = await runCommand('definitely-missing-esoft-command');

  assert.equal(result.ok, false);
  assert.equal(result.code, null);
  assert.equal(typeof result.stderr, 'string');
});

test('runCommand times out and settles', async () => {
  const result = await runCommand(process.execPath, [
    resolve(fixtures, 'wait.mjs'),
  ], {
    timeoutMs: 100,
  });

  assert.equal(result.ok, false);
  assert.equal(result.timedOut, true);
});

test('runCommand validates timeoutMs', () => {
  for (const timeoutMs of [Infinity, NaN, -1, '100']) {
    assert.throws(
      () => runCommand(process.execPath, [], { timeoutMs }),
      /timeoutMs must be a non-negative finite number/,
    );
  }
});

test('runCommand terminates a timed out POSIX process group', {
  skip: process.platform === 'win32',
}, async () => {
  const project = await createTemporaryProject();
  const readyPath = resolve(project.root, 'grandchild-ready.txt');
  const markerPath = resolve(project.root, 'grandchild-marker.txt');
  let resultPromise;

  try {
    resultPromise = runCommand(process.execPath, [
      resolve(fixtures, 'spawn-grandchild-marker.mjs'),
      readyPath,
      markerPath,
    ], {
      timeoutMs: 1_000,
    });

    await waitForFile(readyPath, 750);

    const result = await resultPromise;

    await delay(1_600);

    assert.equal(result.ok, false);
    assert.equal(result.timedOut, true);
    assert.equal(result.terminationFailed, undefined);
    assert.match(result.stdout, /^READY$/m);
    assert.equal(existsSync(markerPath), false);
  } finally {
    await resultPromise?.catch(() => undefined);
    await project.remove();
  }
});

async function waitForFile(path, timeoutMs) {
  const startedAt = Date.now();

  while (Date.now() - startedAt <= timeoutMs) {
    if (existsSync(path)) {
      return;
    }

    await delay(25);
  }

  throw new Error(`Timed out waiting for file: ${path}`);
}
