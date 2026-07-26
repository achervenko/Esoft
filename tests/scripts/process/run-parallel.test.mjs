import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { createTemporaryProject } from '../helpers/temporary-project.mjs';
import {
  runCommand,
  runParallel,
} from '../../../scripts/process/run-parallel.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixtures = resolve(__dirname, '../fixtures/child-processes');

test('process runCommand resolves successful child exit', async () => {
  const result = await runCommand(process.execPath, [
    resolve(fixtures, 'exit-zero.mjs'),
  ], {
    stdio: 'ignore',
  });

  assert.deepEqual(result, {
    code: 0,
    signal: null,
  });
});

test('process runCommand resolves non-zero child exit', async () => {
  const result = await runCommand(process.execPath, [
    resolve(fixtures, 'exit-one.mjs'),
  ], {
    stdio: 'ignore',
  });

  assert.deepEqual(result, {
    code: 1,
    signal: null,
  });
});

test('process runCommand passes cwd to the child process', async () => {
  const project = await createTemporaryProject();

  try {
    const result = await runCommand(
      process.execPath,
      [
        '-e',
        `process.exit(process.cwd() === ${JSON.stringify(project.root)} ? 0 : 9)`,
      ],
      {
        cwd: project.root,
        stdio: 'ignore',
      },
    );

    assert.deepEqual(result, {
      code: 0,
      signal: null,
    });
  } finally {
    await project.remove();
  }
});

test('process runCommand passes custom env', async () => {
  const result = await runCommand(process.execPath, [
    '-e',
    "process.exit(process.env.ESOFT_PROCESS_ENV === 'ok' ? 0 : 9)",
  ], {
    env: {
      ...process.env,
      ESOFT_PROCESS_ENV: 'ok',
    },
    stdio: 'ignore',
  });

  assert.equal(result.code, 0);
});

test('process runCommand inherits process.env when env is omitted', async () => {
  const previous = process.env.ESOFT_PROCESS_INHERITED;
  process.env.ESOFT_PROCESS_INHERITED = 'parent-value';

  try {
    const result = await runCommand(process.execPath, [
      '-e',
      "process.exit(process.env.ESOFT_PROCESS_INHERITED === 'parent-value' ? 0 : 9)",
    ], {
      stdio: 'ignore',
    });

    assert.deepEqual(result, {
      code: 0,
      signal: null,
    });
  } finally {
    if (previous === undefined) {
      delete process.env.ESOFT_PROCESS_INHERITED;
    } else {
      process.env.ESOFT_PROCESS_INHERITED = previous;
    }
  }
});

test('process runCommand uses the provided env without merging process.env', async () => {
  const previous = process.env.ESOFT_PROCESS_INHERITED;
  process.env.ESOFT_PROCESS_INHERITED = 'parent-value';

  try {
    const result = await runCommand(process.execPath, [
      '-e',
      [
        "process.exit(",
        "process.env.ESOFT_PROCESS_ENV === 'ok' &&",
        "process.env.ESOFT_PROCESS_INHERITED === undefined ? 0 : 9",
        ')',
      ].join(' '),
    ], {
      env: {
        ESOFT_PROCESS_ENV: 'ok',
      },
      stdio: 'ignore',
    });

    assert.deepEqual(result, {
      code: 0,
      signal: null,
    });
  } finally {
    if (previous === undefined) {
      delete process.env.ESOFT_PROCESS_INHERITED;
    } else {
      process.env.ESOFT_PROCESS_INHERITED = previous;
    }
  }
});

test('process runCommand reports child signal termination', async () => {
  const result = await runCommand(process.execPath, [
    '-e',
    "process.kill(process.pid, 'SIGTERM')",
  ], {
    stdio: 'ignore',
  });

  if (process.platform === 'win32') {
    assert.equal(result.signal, null);
    assert.notEqual(result.code, 0);
    return;
  }

  assert.deepEqual(result, {
    code: null,
    signal: 'SIGTERM',
  });
});

test('process runCommand rejects missing executable', async () => {
  await assert.rejects(
    () => runCommand('definitely-missing-esoft-command', [], { stdio: 'ignore' }),
    /ENOENT|not found|spawn/i,
  );
});

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
