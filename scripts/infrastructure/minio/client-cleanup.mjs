import { failure } from '../result.mjs';
import { formatError } from '../security/redaction.mjs';

export function destroyClient(client) {
  try {
    client.destroy();

    return { ok: true };
  } catch (error) {
    return {
      error: formatError(error),
      ok: false,
    };
  }
}

export function mergeClientCleanupResult(operationResult, cleanupResult) {
  if (cleanupResult.ok) {
    return operationResult;
  }

  if (!operationResult.ok) {
    return failure(operationResult.code, operationResult.message, {
      ...(operationResult.details ?? {}),
      cleanupError: cleanupResult.error,
    });
  }

  return failure(
    'MINIO_CLIENT_CLEANUP_FAILED',
    'Unable to close MinIO client',
    {
      cleanupError: cleanupResult.error,
      operationResult,
    },
  );
}
