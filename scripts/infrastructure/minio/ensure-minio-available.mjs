import { mkdir } from 'node:fs/promises';

import { failure, success } from '../result.mjs';
import { formatError } from '../security/redaction.mjs';
import {
  spawnMinio,
  terminateUnregisteredMinioProcess,
  waitForSpawn,
  waitForTemporaryMinioReadiness,
} from './minio-process.mjs';
import { checkMinioPortsAvailable } from './port-availability.mjs';
import { checkMinioReadiness } from './readiness.mjs';
import { createStderrCollector } from './stderr-collector.mjs';

const MINIO_READINESS_TIMEOUT_MS = 30_000;
const STDERR_MAX_BYTES = 64 * 1024;

export async function ensureMinioAvailable({
  config,
  resources,
  checkReadiness = checkMinioReadiness,
  checkPortsAvailable = checkMinioPortsAvailable,
  mkdirImpl = mkdir,
  readinessTimeoutMs = MINIO_READINESS_TIMEOUT_MS,
  spawnProcess = spawnMinio,
  terminateUnregisteredProcess = terminateUnregisteredMinioProcess,
}) {
  if (!Number.isFinite(readinessTimeoutMs) || readinessTimeoutMs <= 0) {
    throw new TypeError('readinessTimeoutMs must be a positive finite number');
  }

  let ready;

  try {
    ready = await checkReadiness({ config });
  } catch (error) {
    return failure('MINIO_READINESS_FAILED', 'Unable to check MinIO readiness', {
      error: formatError(error),
    });
  }

  if (ready.ok) {
    return success('MINIO_AVAILABLE', 'MinIO is available', {
      startedTemporarily: false,
    });
  }

  let ports;

  try {
    ports = await checkPortsAvailable({
      config,
    });
  } catch (error) {
    return failure('MINIO_PORT_CHECK_FAILED', 'Unable to check MinIO ports', {
      error: formatError(error),
    });
  }

  if (!ports.ok) {
    return ports;
  }

  try {
    await mkdirImpl(config.minio.dataDir, { recursive: true });
  } catch (error) {
    return failure('MINIO_DATA_DIR_FAILED', 'Unable to prepare MinIO data directory', {
      error: formatError(error),
    });
  }

  let child;

  try {
    child = spawnProcess({ config });
  } catch (error) {
    return failure('MINIO_START_FAILED', 'Unable to start MinIO', {
      error: formatError(error),
    });
  }

  let stderr;

  try {
    stderr = createStderrCollector(child, {
      maxBytes: STDERR_MAX_BYTES,
      sensitiveValues: [
        config.minio.rootUser,
        config.minio.rootPassword,
        config.minio.accessKey,
        config.minio.secretKey,
      ],
    });
  } catch (error) {
    const terminated = await safelyTerminateUnregisteredProcess(
      child,
      terminateUnregisteredProcess,
    );

    return failure('MINIO_START_FAILED', 'Unable to initialize MinIO diagnostics', {
      cleanupFailed: !terminated.ok,
      cleanupError: terminated.ok ? undefined : terminated.message,
      error: formatError(error),
    });
  }

  let registered;

  try {
    registered = resources.registerProcess({
      child,
      name: 'MinIO',
    });
  } catch (error) {
    const terminated = await safelyTerminateUnregisteredProcess(
      child,
      terminateUnregisteredProcess,
    );

    return failure('MINIO_START_FAILED', 'Unable to register MinIO cleanup', {
      cleanupFailed: !terminated.ok,
      cleanupError: terminated.ok ? undefined : terminated.message,
      error: formatError(error),
      stderr: stderr.value(),
    });
  }

  const started = await waitForSpawn(child);

  if (!started.ok) {
    return failure('MINIO_START_FAILED', 'Unable to start MinIO', {
      error: formatError(started.error),
      stderr: stderr.value(),
    });
  }

  const readiness = await waitForTemporaryMinioReadiness({
    checkReadiness,
    config,
    closePromise: registered.closePromise,
    readinessTimeoutMs,
  });

  if (readiness.closed) {
    return failure(
      'MINIO_EXITED_BEFORE_READY',
      'MinIO exited before becoming ready',
      {
        stderr: stderr.value(),
      },
    );
  }

  if (!readiness.result.ok) {
    return failure(readiness.result.code, readiness.result.message, {
      ...(readiness.result.details ?? {}),
      stderr: stderr.value(),
    });
  }

  return success('MINIO_STARTED_TEMPORARILY', 'MinIO started temporarily', {
    startedTemporarily: true,
  });
}

async function safelyTerminateUnregisteredProcess(
  child,
  terminateUnregisteredProcess,
) {
  try {
    const result = await terminateUnregisteredProcess(child);

    if (result?.ok) {
      return { ok: true };
    }

    return {
      message:
        result?.message ?? 'Unregistered MinIO process termination failed',
      ok: false,
    };
  } catch (error) {
    return {
      message: formatError(error),
      ok: false,
    };
  }
}
