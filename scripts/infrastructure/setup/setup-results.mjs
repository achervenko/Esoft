import { failure } from '../result.mjs';
import {
  formatError,
  redactSecrets,
} from '../security/redaction.mjs';

export async function runSetupStep(step, context) {
  try {
    const result = await step.run(context);

    if (!isOperationResult(result)) {
      return failure(
        'SETUP_STEP_INVALID_RESULT',
        `${step.label} returned an invalid OperationResult`,
        {
          step: step.label,
        },
      );
    }

    return sanitizeResult(result);
  } catch (error) {
    return failure('SETUP_STEP_EXCEPTION', `${step.label} failed unexpectedly`, {
      error: formatError(error),
      step: step.label,
    });
  }
}

export async function cleanupResources(resources) {
  try {
    const cleanup = await resources.cleanup();

    if (
      cleanup !== null &&
      typeof cleanup === 'object' &&
      !Array.isArray(cleanup) &&
      typeof cleanup.ok === 'boolean'
    ) {
      return sanitizeResult(cleanup);
    }

    return {
      error: 'Cleanup returned an invalid result',
      ok: false,
    };
  } catch (error) {
    return {
      error: formatError(error),
      ok: false,
    };
  }
}

export function safeResults(results) {
  return results.map(({ label, result }) => ({
    label,
    result: sanitizeResult(result),
  }));
}

export function cloneResult(result) {
  return sanitizeResult(result);
}

function isOperationResult(result) {
  if (
    result === null ||
    typeof result !== 'object' ||
    Array.isArray(result) ||
    typeof result.ok !== 'boolean' ||
    typeof result.code !== 'string' ||
    result.code === '' ||
    typeof result.message !== 'string' ||
    result.message === ''
  ) {
    return false;
  }

  if (
    'details' in result &&
    (result.details === null ||
      typeof result.details !== 'object' ||
      Array.isArray(result.details))
  ) {
    return false;
  }

  return true;
}

function sanitizeResult(result) {
  return redactSecrets(result);
}
