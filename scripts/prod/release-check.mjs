import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  createNpmInvocation,
  npmArgs,
} from '../infrastructure/commands/npm-command.mjs';
import { runCommand } from '../infrastructure/commands/run-command.mjs';
import { failure, success } from '../infrastructure/result.mjs';
import {
  formatError,
  redactSecrets,
  redactSensitiveText,
} from '../infrastructure/security/redaction.mjs';

const STAGES = Object.freeze([
  {
    label: 'Checking encoding',
    script: 'check:encoding:strict',
    timeoutMs: 30_000,
  },
  {
    label: 'Validating configuration',
    script: 'config:validate',
    timeoutMs: 30_000,
  },
  {
    label: 'Running lint',
    script: 'lint',
    timeoutMs: 120_000,
  },
  {
    label: 'Running script tests',
    script: 'test:scripts',
    timeoutMs: 180_000,
  },
  {
    label: 'Running application tests',
    script: 'test',
    timeoutMs: 300_000,
  },
  {
    label: 'Building production artifacts',
    script: 'build',
    timeoutMs: 300_000,
  },
]);

const defaultProjectRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../..',
);

export async function runReleaseCheck(options = {}) {
  const output = options.output ?? console;
  const projectRoot = options.projectRoot ?? defaultProjectRoot;
  const npmInvocation =
    options.npmInvocation ?? createNpmInvocation();
  const commandRunner = options.runCommand ?? runCommand;
  const stages = [];

  for (const [stageIndex, stage] of STAGES.entries()) {
    const result = await runStage({
      commandRunner,
      npmInvocation,
      output,
      projectRoot,
      stage,
      stageIndex,
      total: STAGES.length,
    });
    stages.push({
      label: stage.label,
      script: stage.script,
      result,
    });

    if (!result.ok) {
      const finalResult = failure(
        'RELEASE_CHECK_FAILED',
        'Release check failed',
        {
          failedStage: stage.label,
          stages,
        },
      );
      output.log('Release check failed.');
      return redactSecrets(finalResult);
    }
  }

  const finalResult = success(
    'RELEASE_CHECK_OK',
    'Release check completed',
    {
      stages,
    },
  );
  output.log('Release check completed successfully.');
  return redactSecrets(finalResult);
}

async function runStage({
  commandRunner,
  npmInvocation,
  output,
  projectRoot,
  stage,
  stageIndex,
  total,
}) {
  output.log(`[${stageIndex + 1}/${total}] ${stage.label}...`);

  let commandResult;

  try {
    commandResult = await commandRunner(
      npmInvocation.command,
      [
        ...npmInvocation.argsPrefix,
        ...npmArgs(['run', stage.script]),
      ],
      {
        cwd: projectRoot,
        timeoutMs: stage.timeoutMs,
      },
    );
  } catch (error) {
    const result = failure(
      'RELEASE_CHECK_COMMAND_FAILED',
      'Command failed before completion.',
      {
        error: formatError(error),
        script: stage.script,
      },
    );
    outputFailure(output, result);
    return redactSecrets(result);
  }

  if (commandResult.ok) {
    const result = success(
      'RELEASE_CHECK_STAGE_OK',
      'Release check stage completed',
      {
        script: stage.script,
      },
    );
    output.log('OK');
    return result;
  }

  const result = failure(
    'RELEASE_CHECK_COMMAND_FAILED',
    toCommandFailureMessage(commandResult),
    {
      code: commandResult.code,
      script: stage.script,
      signal: commandResult.signal,
      stderr: redactSensitiveText(commandResult.stderr ?? ''),
      stdout: redactSensitiveText(commandResult.stdout ?? ''),
      timedOut: Boolean(commandResult.timedOut),
    },
  );
  outputFailure(output, result);
  outputCommandDiagnostics(output, commandResult);
  return redactSecrets(result);
}

function outputFailure(output, result) {
  output.log('FAILED');
  output.log(redactSensitiveText(result.message));
}

function outputCommandDiagnostics(output, commandResult) {
  const stdout = redactSensitiveText(commandResult.stdout ?? '').trim();
  const stderr = redactSensitiveText(commandResult.stderr ?? '').trim();

  if (stdout) {
    output.log('');
    output.log('stdout:');
    output.log(stdout);
  }

  if (stderr) {
    output.log('');
    output.log('stderr:');
    output.log(stderr);
  }
}

function toCommandFailureMessage(commandResult) {
  if (commandResult.timedOut) {
    return 'Command timed out.';
  }

  if (commandResult.code !== null && commandResult.code !== undefined) {
    return `Command exited with code ${commandResult.code}.`;
  }

  if (commandResult.signal) {
    return `Command exited with signal ${commandResult.signal}.`;
  }

  return 'Command failed.';
}

const isMainModule =
  process.argv[1] &&
  fileURLToPath(import.meta.url) === resolve(process.argv[1]);

if (isMainModule) {
  const result = await runReleaseCheck();

  process.exitCode = result.ok ? 0 : 1;
}
