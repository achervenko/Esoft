import { failure } from '../infrastructure/result.mjs';
import {
  formatError,
  redactSecrets,
  redactSensitiveText,
} from '../infrastructure/security/redaction.mjs';

export function createProductionSetupReporter({ output = console } = {}) {
  return {
    start(index, total, label) {
      output.log(`[${index}/${total}] ${label}...`);
    },
    finish(result) {
      output.log(result.ok ? 'OK' : 'FAILED');

      if (!result.ok) {
        output.log(redactSensitiveText(result.message));
      }
    },
    success() {
      output.log('Production setup completed successfully.');
    },
    failure() {
      output.log('Production setup failed.');
    },
  };
}

export function createProductionSetupStageRunner({
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
      result = failure('PROD_SETUP_STAGE_FAILED', `${label} failed`, {
        error: formatError(error),
      });
    }

    const safeResult = redactSecrets(result);
    results.push({ label, result: safeResult });
    reporter.finish(safeResult);

    if (onStage) {
      await onStage(label, safeResult);
    }

    return {
      result: safeResult,
      value,
    };
  };
}

export function finishProductionSetupFailure(result, results, reporter) {
  const finalResult = failure('PROD_SETUP_FAILED', result.message, {
    failedCode: result.code,
    results,
  });
  reporter.failure?.();

  return finalResult;
}

function defaultSelectResult(value) {
  return value;
}
