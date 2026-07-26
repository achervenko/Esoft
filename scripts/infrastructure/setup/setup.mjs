import { createResourceRegistry } from '../resources/resource-registry.mjs';
import { failure, success } from '../result.mjs';
import { formatError } from '../security/redaction.mjs';
import { createDefaultSetupOperations } from './setup-operations.mjs';
import {
  cleanupResources,
  cloneResult,
  runSetupStep,
  safeResults,
} from './setup-results.mjs';
import { SETUP_STEPS } from './setup-steps.mjs';

export { createDefaultSetupOperations } from './setup-operations.mjs';

export async function runInfrastructureSetup({
  commands,
  config,
  npm,
  onStep = () => undefined,
  operations = {},
  PgClient,
  projectRoot,
  resources = createResourceRegistry(),
  runCommand,
  S3Client,
  isShuttingDown = () => false,
}) {
  const setupOperations = {
    ...createDefaultSetupOperations(),
    ...operations,
  };
  const results = [];
  let setupResult = null;

  try {
    for (const step of SETUP_STEPS) {
      let shuttingDown;

      try {
        shuttingDown = Boolean(isShuttingDown());
      } catch (error) {
        setupResult = failure(
          'SETUP_SHUTDOWN_CHECK_FAILED',
          'Unable to determine setup shutdown state',
          {
            error: formatError(error),
            results: safeResults(results),
          },
        );
        break;
      }

      if (shuttingDown) {
        setupResult = failure('SETUP_ABORTED', 'Setup was interrupted', {
          results: safeResults(results),
        });
        break;
      }

      const result = await runSetupStep(step, {
        commands,
        config,
        npm,
        operations: setupOperations,
        PgClient,
        projectRoot,
        resources,
        runCommand,
        S3Client,
      });

      const failed = !result.ok;
      const storedResult = cloneResult(result);

      results.push({ label: step.label, result: storedResult });

      let stepCallbackError = null;

      try {
        await onStep(step.label, cloneResult(storedResult));
      } catch (error) {
        stepCallbackError = formatError(error);
      }

      if (failed) {
        setupResult = failure('SETUP_FAILED', result.message, {
          ...(stepCallbackError === null ? {} : { stepCallbackError }),
          failedStep: step.label,
          results: safeResults(results),
        });
        break;
      }

      if (stepCallbackError !== null) {
        setupResult = failure(
          'SETUP_STEP_CALLBACK_FAILED',
          `Step callback failed for ${step.label}`,
          {
            error: stepCallbackError,
            failedStep: step.label,
            results: safeResults(results),
          },
        );
        break;
      }
    }

    setupResult ??= success('SETUP_OK', 'Setup completed successfully', {
      results: safeResults(results),
    });
  } finally {
    const cleanup = await cleanupResources(resources);

    if (!cleanup.ok) {
      const cleanupFailure = failure('SETUP_CLEANUP_FAILED', 'Setup cleanup failed', {
        cleanup,
        setupResult,
      });

      try {
        await onStep('Cleanup', cloneResult(cleanupFailure));
      } catch {
        // Cleanup failure already has priority over report callback failures.
      }

      setupResult = cleanupFailure;
    }
  }

  return setupResult;
}
