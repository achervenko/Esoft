import { resolve } from 'node:path';
import installationLock from '../infrastructure/operations/installation-lock.cjs';

import { failure } from '../infrastructure/result.mjs';
import { formatError } from '../infrastructure/security/redaction.mjs';

// Shared by all backup/restore commands of the same application installation.
export async function withProductionOperationLock({
  projectRoot,
  operation,
  run,
  onFailure = (result) => result,
}) {
  const root = resolve(projectRoot, '.local');
  const lockPath = resolve(root, '.production-operation.lock');
  let lease;
  try {
    lease = installationLock.acquireInstallationLock({
      projectRoot,
      operation,
    });
  } catch (error) {
    return onFailure(
      failure(
        error.code === 'INSTALLATION_LOCK_CLEANUP_FAILED'
          ? 'PRODUCTION_OPERATION_UNLOCK_FAILED'
          : error.code === 'EEXIST'
            ? 'PRODUCTION_OPERATION_BUSY'
            : 'PRODUCTION_OPERATION_LOCK_FAILED',
        error.code === 'INSTALLATION_LOCK_CLEANUP_FAILED'
          ? 'Unable to clean up production operation lock after initialization failure'
          : error.code === 'EEXIST'
            ? 'Backend or another production operation holds the lock; stop backend or verify the operation before removing a stale lock'
            : 'Unable to acquire production operation lock',
        {
          lockPath,
          ...(error.code === 'EEXIST' ? {} : { error: formatError(error) }),
          ...(error.code === 'INSTALLATION_LOCK_CLEANUP_FAILED'
            ? {
                operationError: formatError(error.cause),
                cleanupError: formatError(error.cleanupError),
              }
            : {}),
        },
      ),
    );
  }

  let result;
  let operationError;
  let cleanupFailure;
  try {
    result = await run();
  } catch (error) {
    operationError = error;
  } finally {
    try {
      lease.release();
    } catch (error) {
      cleanupFailure = failure(
        'PRODUCTION_OPERATION_UNLOCK_FAILED',
        'Unable to release production operation lock',
        {
          lockPath,
          error: formatError(error),
          ...(result !== undefined ? { operationResult: result } : {}),
          ...(operationError
            ? { operationError: formatError(operationError) }
            : {}),
        },
      );
    }
  }
  if (cleanupFailure) return onFailure(cleanupFailure);
  if (operationError) throw operationError;
  return result;
}
