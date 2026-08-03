import assert from 'node:assert/strict';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { runReleaseCheck } from '../../../scripts/prod/release-check.mjs';
import {
  assertNoSecretLeak,
  assertOperationResult,
  SECRET_MARKERS,
} from '../helpers/operation-result.mjs';

const EXPECTED_SCRIPTS = Object.freeze([
  'check:encoding:strict',
  'config:validate',
  'lint',
  'test:scripts',
  'test',
  'build',
]);

const EXPECTED_TIMEOUTS = Object.freeze([
  30_000,
  30_000,
  120_000,
  180_000,
  300_000,
  300_000,
]);

test('release:check happy path runs all stages in order', async () => {
  const calls = [];
  const result = await runReleaseCheck({
    ...createTestRuntime({ calls }),
  });

  assertOperationResult(result, { ok: true });
  assert.equal(result.code, 'RELEASE_CHECK_OK');
  assert.deepEqual(calls.map((call) => call.script), EXPECTED_SCRIPTS);
  assert.deepEqual(calls.map((call) => call.cwd), Array(6).fill('C:/project'));
});

test('release:check uses expected timeout values', async () => {
  const calls = [];

  await runReleaseCheck({
    ...createTestRuntime({ calls }),
  });

  assert.deepEqual(
    calls.map((call) => call.timeoutMs),
    EXPECTED_TIMEOUTS,
  );
});

test('release:check stops after encoding failure', async () => {
  const calls = [];
  const result = await runReleaseCheck({
    ...createTestRuntime({
      calls,
      failScripts: {
        'check:encoding:strict': commandFailure(),
      },
    }),
  });

  assertOperationResult(result, { ok: false });
  assert.equal(result.code, 'RELEASE_CHECK_FAILED');
  assert.deepEqual(calls.map((call) => call.script), ['check:encoding:strict']);
});

test('release:check stops after config validation failure', async () => {
  const calls = [];
  const result = await runReleaseCheck({
    ...createTestRuntime({
      calls,
      failScripts: {
        'config:validate': commandFailure(),
      },
    }),
  });

  assertOperationResult(result, { ok: false });
  assert.deepEqual(calls.map((call) => call.script), [
    'check:encoding:strict',
    'config:validate',
  ]);
});

test('release:check stops after lint failure', async () => {
  const calls = [];
  const result = await runReleaseCheck({
    ...createTestRuntime({
      calls,
      failScripts: {
        lint: commandFailure(),
      },
    }),
  });

  assertOperationResult(result, { ok: false });
  assert.equal(result.details.failedStage, 'Running lint');
  assert.deepEqual(calls.map((call) => call.script), [
    'check:encoding:strict',
    'config:validate',
    'lint',
  ]);
});

test('release:check stops after script tests failure', async () => {
  const calls = [];
  const result = await runReleaseCheck({
    ...createTestRuntime({
      calls,
      failScripts: {
        'test:scripts': commandFailure(),
      },
    }),
  });

  assertOperationResult(result, { ok: false });
  assert.deepEqual(calls.map((call) => call.script), [
    'check:encoding:strict',
    'config:validate',
    'lint',
    'test:scripts',
  ]);
});

test('release:check stops after application tests failure', async () => {
  const calls = [];
  const result = await runReleaseCheck({
    ...createTestRuntime({
      calls,
      failScripts: {
        test: commandFailure(),
      },
    }),
  });

  assertOperationResult(result, { ok: false });
  assert.deepEqual(calls.map((call) => call.script), [
    'check:encoding:strict',
    'config:validate',
    'lint',
    'test:scripts',
    'test',
  ]);
});

test('release:check reports build failure as final failure', async () => {
  const calls = [];
  const result = await runReleaseCheck({
    ...createTestRuntime({
      calls,
      failScripts: {
        build: commandFailure({ code: 2 }),
      },
    }),
  });

  assertOperationResult(result, { ok: false });
  assert.equal(result.code, 'RELEASE_CHECK_FAILED');
  assert.deepEqual(calls.map((call) => call.script), EXPECTED_SCRIPTS);
  assert.equal(
    result.details.stages.at(-1).result.message,
    'Command exited with code 2.',
  );
});

test('release:check maps thrown command exceptions and stops', async () => {
  const calls = [];
  const result = await runReleaseCheck({
    ...createTestRuntime({
      calls,
      throwScripts: {
        lint: new Error('spawn boom'),
      },
    }),
  });

  assertOperationResult(result, { ok: false });
  assert.deepEqual(calls.map((call) => call.script), [
    'check:encoding:strict',
    'config:validate',
    'lint',
  ]);
  assert.equal(
    result.details.stages.at(-1).result.code,
    'RELEASE_CHECK_COMMAND_FAILED',
  );
});

test('release:check reports timeout failure', async () => {
  const result = await runReleaseCheck({
    ...createTestRuntime({
      failScripts: {
        'test:scripts': commandFailure({
          code: null,
          stderr: 'timed out',
          timedOut: true,
        }),
      },
    }),
  });

  assertOperationResult(result, { ok: false });
  assert.equal(
    result.details.stages.at(-1).result.message,
    'Command timed out.',
  );
  assert.equal(result.details.stages.at(-1).result.details.timedOut, true);
});

test('release:check prints stdout when a command fails', async () => {
  const output = createOutput();

  await runReleaseCheck({
    ...createTestRuntime({
      output,
      failScripts: {
        lint: commandFailure({
          stderr: '',
          stdout: 'lint stdout diagnostics',
        }),
      },
    }),
  });

  assertOutputIncludesSequence(output.lines, [
    'FAILED',
    'Command exited with code 1.',
    '',
    'stdout:',
    'lint stdout diagnostics',
  ]);
});

test('release:check prints stderr when a command fails', async () => {
  const output = createOutput();

  await runReleaseCheck({
    ...createTestRuntime({
      output,
      failScripts: {
        lint: commandFailure({
          stderr: 'lint stderr diagnostics',
        }),
      },
    }),
  });

  assertOutputIncludesSequence(output.lines, [
    'FAILED',
    'Command exited with code 1.',
    '',
    'stderr:',
    'lint stderr diagnostics',
  ]);
});

test('release:check omits empty command diagnostics sections', async () => {
  const output = createOutput();

  await runReleaseCheck({
    ...createTestRuntime({
      output,
      failScripts: {
        lint: commandFailure({
          stderr: '   ',
          stdout: '',
        }),
      },
    }),
  });

  assert.equal(output.lines.includes('stdout:'), false);
  assert.equal(output.lines.includes('stderr:'), false);
});

test('release:check does not leak secrets from command diagnostics', async () => {
  const output = createOutput();
  const result = await runReleaseCheck({
    ...createTestRuntime({
      output,
      failScripts: {
        lint: commandFailure({
          stderr: `stderr ${SECRET_MARKERS[0]}`,
          stdout: `stdout ${SECRET_MARKERS[1]}`,
        }),
      },
    }),
  });

  assertOperationResult(result, { ok: false });
  assertNoSecretLeak(result);
  assertNoSecretLeak(output.lines);
  assert.equal(output.lines.includes('stdout:'), true);
  assert.equal(output.lines.includes('stderr:'), true);
});

test('release:check successful stages only print OK', async () => {
  const output = createOutput();

  await runReleaseCheck({
    ...createTestRuntime({
      output,
    }),
  });

  assert.equal(output.lines.includes('stdout:'), false);
  assert.equal(output.lines.includes('stderr:'), false);
  assert.equal(output.lines.filter((line) => line === 'OK').length, 6);
});

test('release:check uses exact root npm scripts', async () => {
  const calls = [];

  await runReleaseCheck({
    ...createTestRuntime({ calls }),
  });

  for (const [index, call] of calls.entries()) {
    assert.equal(call.command, 'npm');
    assert.deepEqual(call.args, ['run', EXPECTED_SCRIPTS[index]]);
  }
});

test('release:check invokes npm through the injected npm cli path', async () => {
  const calls = [];
  const npmExecPath = 'C:/Program Files/nodejs/node_modules/npm/bin/npm-cli.js';

  await runReleaseCheck({
    ...createTestRuntime({
      calls,
      npmInvocation: {
        command: 'C:/Program Files/nodejs/node.exe',
        argsPrefix: [npmExecPath],
      },
    }),
  });

  assert.equal(calls[0].command, 'C:/Program Files/nodejs/node.exe');
  assert.deepEqual(calls[0].args, [
    npmExecPath,
    'run',
    'check:encoding:strict',
  ]);
});

test('release:check supports fallback npm invocation without args prefix', async () => {
  const calls = [];

  await runReleaseCheck({
    ...createTestRuntime({
      calls,
      npmInvocation: {
        command: 'npm-test',
        argsPrefix: [],
      },
    }),
  });

  assert.equal(calls[0].command, 'npm-test');
  assert.deepEqual(calls[0].args, ['run', 'check:encoding:strict']);
});

test('release:check defaults cwd to the project root', async () => {
  const calls = [];
  const expectedProjectRoot = resolve(
    dirname(fileURLToPath(import.meta.url)),
    '../../..',
  );

  await runReleaseCheck({
    npmInvocation: {
      command: 'npm',
      argsPrefix: [],
    },
    output: createOutput(),
    runCommand: async (command, args, options) => {
      calls.push({
        cwd: options.cwd,
      });

      return {
        code: 0,
        ok: true,
        signal: null,
        stderr: '',
        stdout: '',
        timedOut: false,
      };
    },
  });

  assert.deepEqual(
    calls.map((call) => call.cwd),
    Array(6).fill(expectedProjectRoot),
  );
});

function createTestRuntime({
  calls = [],
  failScripts = {},
  npmInvocation = {
    command: 'npm',
    argsPrefix: [],
  },
  output = createOutput(),
  projectRoot = 'C:/project',
  throwScripts = {},
} = {}) {
  return {
    npmInvocation,
    output,
    projectRoot,
    runCommand: async (command, args, options) => {
      const script = args.at(-1);
      calls.push({
        args,
        command,
        cwd: options.cwd,
        script,
        timeoutMs: options.timeoutMs,
      });

      if (script in throwScripts) {
        throw throwScripts[script];
      }

      if (script in failScripts) {
        return failScripts[script];
      }

      return {
        code: 0,
        ok: true,
        signal: null,
        stderr: '',
        stdout: '',
        timedOut: false,
      };
    },
  };
}

function commandFailure({
  code = 1,
  signal = null,
  stderr = 'failed',
  stdout = '',
  timedOut = false,
} = {}) {
  return {
    code,
    ok: false,
    signal,
    stderr,
    stdout,
    timedOut,
  };
}

function createOutput() {
  const lines = [];

  return {
    lines,
    log(value = '') {
      lines.push(String(value));
    },
  };
}

function assertOutputIncludesSequence(lines, expectedSequence) {
  for (
    let index = 0;
    index <= lines.length - expectedSequence.length;
    index += 1
  ) {
    if (
      expectedSequence.every(
        (expectedLine, offset) => lines[index + offset] === expectedLine,
      )
    ) {
      return;
    }
  }

  assert.fail(
    `Expected output to include sequence ${JSON.stringify(expectedSequence)}`,
  );
}
