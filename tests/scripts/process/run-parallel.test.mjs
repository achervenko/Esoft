import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import {
  assertNoSecretLeak,
  SECRET_MARKERS,
} from '../helpers/operation-result.mjs';
import { runParallel } from '../../../scripts/process/run-parallel.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixtures = resolve(__dirname, '../fixtures/child-processes');

test('runParallel rejects non-array and empty command lists', () => {
  assert.throws(() => runParallel(null), /At least one command/);
  assert.throws(() => runParallel([]), /At least one command/);
});

test('runParallel starts multiple commands before exiting successfully', async () => {
  const result = await runNodeFixture('run-parallel-success.mjs');

  assert.equal(result.code, 0);
  assert.equal(result.signal, null);
  assert.equal(result.stdout.includes('[first] Starting...'), true);
  assert.equal(result.stdout.includes('[second] Starting...'), true);
  assert.equal(result.stdout.includes('first-child-started'), true);
  assert.equal(result.stdout.includes('second-child-started'), true);
});

test('runParallel exits with a failing child code and stops sibling processes', async () => {
  const result = await runNodeFixture('run-parallel-failure.mjs', {
    timeoutMs: 5_000,
  });

  assert.equal(result.code, 7);
  assert.equal(result.signal, null);
  assert.equal(result.stdout.includes('[failing] Starting...'), true);
  assert.equal(result.stdout.includes('[long-running] Starting...'), true);
  assert.equal(result.stderr.includes('[failing] Exited with code 7.'), true);
});

test('runParallel redacts spawn errors', async () => {
  const result = await runNodeFixture('run-parallel-spawn-error-secret.mjs');

  assert.equal(result.code, 1);
  assert.equal(result.signal, null);
  assert.equal(result.stderr.includes('[secret-spawn] Failed to start:'), true);
  assert.equal(result.stderr.includes('[redacted]'), true);
  assertNoSecretLeak(result.stderr);
  assert.equal(result.stderr.includes(SECRET_MARKERS[0]), false);
});

function runNodeFixture(fixture, { timeoutMs = 3_000 } = {}) {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(process.execPath, [resolve(fixtures, fixture)], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    const timeout = setTimeout(() => {
      child.kill('SIGKILL');
      rejectRun(new Error(`${fixture} timed out`));
    }, timeoutMs);

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.once('error', (error) => {
      clearTimeout(timeout);
      rejectRun(error);
    });
    child.once('close', (code, signal) => {
      clearTimeout(timeout);
      resolveRun({ code, signal, stderr, stdout });
    });
  });
}
