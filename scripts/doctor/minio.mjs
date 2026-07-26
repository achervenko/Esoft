import { mkdir } from 'node:fs/promises';

import { checkMinioBucket } from '../infrastructure/minio/bucket.mjs';
import { createS3Client } from '../infrastructure/minio/client.mjs';
import {
  checkMinioReadiness,
  waitForMinioReadiness,
} from '../infrastructure/minio/readiness.mjs';
import { checkMinioObjectRoundtrip as checkMinioObjectRoundtripOperation } from '../infrastructure/minio/object-roundtrip.mjs';

export async function checkMinio({
  config,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  report,
  S3Client,
  startManagedProcess,
}) {
  report.addSection('MinIO');

  let ready = await checkMinioReady({ config });
  let startedTemporarily = false;

  if (!ready.ok) {
    try {
      await mkdir(config.minio.dataDir, { recursive: true });
    } catch (error) {
      report.add(
        'MinIO',
        'ERROR',
        `Unable to prepare data directory: ${formatError(error)}`,
      );
      return { dependencyOk: false, ok: false };
    }

    const processStarted = await startManagedProcess('minio', config.minio.executable, [
      'server',
      config.minio.dataDir,
      '--address',
      `${config.minio.host}:${config.minio.port}`,
      '--console-address',
      `${config.minio.host}:${config.minio.consolePort}`,
    ], {
      env: createMinioProcessEnv(config),
      ports: [config.minio.port, config.minio.consolePort],
    });

    if (!processStarted.ok) {
      report.add('MinIO', 'ERROR', `Failed to start: ${processStarted.message}`);
      return { dependencyOk: false, ok: false };
    }

    startedTemporarily = true;
    report.add('MinIO', 'INFO', 'MinIO process started; waiting for readiness');
    ready = await waitForMinio({ config });
  }

  if (!ready.ok) {
    report.add('MinIO', 'ERROR', `API ready: ${ready.message}`);
    return { dependencyOk: false, ok: false };
  }

  if (startedTemporarily) {
    report.add('MinIO', 'STARTED', 'MinIO started temporarily');
  }

  report.add('MinIO', 'OK', 'API ready');

  let client;

  try {
    client = createS3Client({ config, S3Client });
  } catch (error) {
    report.add(
      'MinIO',
      'ERROR',
      `Unable to initialize MinIO client: ${formatError(error)}`,
    );
    return { dependencyOk: false, ok: false };
  }

  try {
    const bucket = await checkMinioBucket({
      bucket: config.minio.bucket,
      client,
      HeadBucketCommand,
    });

    if (bucket.ok) {
      report.add('MinIO', 'OK', 'Authentication');
      report.add('MinIO', 'OK', 'Bucket available');
    } else {
      report.add('MinIO', 'ERROR', formatBucketFailure(bucket));
      return { dependencyOk: false, ok: false };
    }

    const roundtrip = await checkMinioObjectRoundtripOperation(client, {
      bucket: config.minio.bucket,
      DeleteObjectCommand,
      GetObjectCommand,
      PutObjectCommand,
    });

    if (roundtrip.ok) {
      report.add('MinIO', 'OK', 'Test object write/read/delete');
      return { dependencyOk: true, ok: true };
    }

    report.add('MinIO', 'ERROR', roundtrip.message);
    return { dependencyOk: true, ok: false };
  } finally {
    try {
      client.destroy();
    } catch {
      // Cleanup failure should not replace the check result.
    }
  }
}

export function createMinioProcessEnv(config, env = process.env) {
  const processEnv = { ...env };

  delete processEnv.MINIO_ACCESS_KEY;
  delete processEnv.MINIO_SECRET_KEY;

  return {
    ...processEnv,
    MINIO_ROOT_PASSWORD: config.minio.rootPassword,
    MINIO_ROOT_USER: config.minio.rootUser,
  };
}

export async function checkMinioReady({ config }) {
  const result = await checkMinioReadiness({ config });
  return {
    code: result.code,
    details: result.details,
    message:
      result.details?.status !== undefined
        ? `HTTP status ${result.details.status}`
        : (result.details?.error ?? result.message),
    ok: result.ok,
  };
}

export async function waitForMinio({ config, timeoutMs = 30_000 }) {
  const result = await waitForMinioReadiness({
    checkReadiness: () => checkMinioReadiness({ config }),
    timeoutMs,
  });

  return {
    code: result.code,
    details: result.details,
    message:
      result.details?.status !== undefined
        ? `HTTP status ${result.details.status}`
        : (result.details?.error ?? result.message),
    ok: result.ok,
  };
}

function formatBucketFailure(bucket) {
  if (bucket.code === 'MINIO_AUTHENTICATION_FAILED') {
    return 'Authentication failed';
  }

  if (bucket.code === 'MINIO_ACCESS_DENIED') {
    return 'Bucket access denied';
  }

  return bucket.message;
}

function formatError(error) {
  return error instanceof Error ? error.message : String(error);
}
