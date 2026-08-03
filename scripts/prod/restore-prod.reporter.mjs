import { failure } from '../infrastructure/result.mjs';
import {
  formatError,
  redactSecrets,
  redactSensitiveText,
} from '../infrastructure/security/redaction.mjs';

export function createProductionRestoreReporter({ output = console } = {}) {
  return {
    notice() {
      output.log('Production backend must be stopped before restore.');
      output.log('Existing PostgreSQL data and MinIO objects will be replaced.');
      output.log('');
    },
    start(index, total, label) {
      output.log(`[${index}/${total}] ${label}...`);
    },
    finish(result) {
      output.log(result.ok ? 'OK' : 'FAILED');

      if (!result.ok) {
        output.log(redactSensitiveText(result.message));
      }
    },
    success(result) {
      output.log('');
      output.log('Restore completed:');
      output.log(redactSensitiveText(result.details.backupPath));
    },
    failure(result) {
      output.log('');
      output.log('Restore failed.');
      output.log(`Stage: ${redactSensitiveText(result.details.failedStage)}`);
      output.log(`Code: ${redactSensitiveText(result.details.failedCode)}`);

      if (result.details.postgresRestored) {
        output.log('PostgreSQL has already been restored.');
      }
    },
    info(message) {
      output.log(redactSensitiveText(message));
    },
  };
}

export function createProductionRestoreStageRunner({
  onStage,
  reporter,
  results,
  totalStages,
}) {
  return async function stage(
    index,
    label,
    run,
    selectResult = defaultSelectResult,
  ) {
    reporter.start(index, totalStages, label);

    let value;
    let result;

    try {
      value = await run();
      result = selectResult(value);
    } catch (error) {
      result = failure('RESTORE_STAGE_FAILED', `${label} failed`, {
        error: formatError(error),
      });
    }

    const safeResult = redactSecrets(result);
    results.push({ label, result: safeResult });
    reporter.finish(safeResult);

    if (onStage) {
      try {
        await onStage(label, safeResult);
      } catch {
        // Stage observers are best-effort and must not affect restore execution.
      }
    }

    return {
      result: safeResult,
      value,
    };
  };
}

export function finishProductionRestoreFailure({
  failedStage,
  reporter,
  restoreState,
  result,
  results,
}) {
  const finalResult = failure('RESTORE_FAILED', result.message, {
    backupPath: restoreState?.backupPath,
    failedCode: result.code,
    failedStage,
    postgresRestored: Boolean(restoreState?.postgresRestored),
    results,
  });

  reporter.failure?.(finalResult);
  return finalResult;
}

function defaultSelectResult(value) {
  return value;
}
