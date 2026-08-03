import { failure } from '../infrastructure/result.mjs';
import {
  formatError,
  redactSecrets,
  redactSensitiveText,
} from '../infrastructure/security/redaction.mjs';

export function createProductionBackupReporter({ output = console } = {}) {
  return {
    notice() {
      output.log('Production backend must be stopped before backup.');
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
      output.log('Backup completed:');
      output.log(redactSensitiveText(result.details.backupPath));
    },
    failure(result) {
      output.log('');
      output.log('Backup failed.');
      output.log(`Stage: ${redactSensitiveText(result.details.failedStage)}`);
      output.log(`Code: ${redactSensitiveText(result.details.failedCode)}`);
    },
    info(message) {
      output.log(redactSensitiveText(message));
    },
  };
}

export function createProductionBackupStageRunner({
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
      result = failure('BACKUP_STAGE_FAILED', `${label} failed`, {
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
        // Stage observers are best-effort and must not affect backup execution.
      }
    }

    return {
      result: safeResult,
      value,
    };
  };
}

export function finishProductionBackupFailure({
  backupState,
  failedStage,
  reporter,
  result,
  results,
}) {
  const finalResult = failure('BACKUP_FAILED', result.message, {
    backupPath: backupState?.finalPath,
    failedCode: result.code,
    failedStage,
    incompletePath: backupState?.incompletePath,
    results,
  });

  reporter.failure?.(finalResult);
  return finalResult;
}

function defaultSelectResult(value) {
  return value;
}
