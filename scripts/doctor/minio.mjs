import { mkdir } from 'node:fs/promises';

import { formatError, delay } from './utils.mjs';

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
  await mkdir(config.minio.dataDir, { recursive: true });

  let ready = await checkMinioReady({ config });

  if (!ready.ok) {
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

    report.add('MinIO', 'STARTED', 'MinIO started temporarily');
    ready = await waitForMinio(30_000, { config });
  }

  if (!ready.ok) {
    report.add('MinIO', 'ERROR', `API ready: ${ready.message}`);
    return { dependencyOk: false, ok: false };
  }

  report.add('MinIO', 'OK', 'API ready');

  const client = createS3Client({ config, S3Client });
  try {
    try {
      await client.send(new HeadBucketCommand({ Bucket: config.minio.bucket }));
      report.add('MinIO', 'OK', 'Authentication');
      report.add('MinIO', 'OK', 'Bucket available');
    } catch (error) {
      report.add('MinIO', 'ERROR', formatError(error));
      return { dependencyOk: false, ok: false };
    }

    try {
      await checkMinioObjectRoundtrip(client, {
        config,
        DeleteObjectCommand,
        GetObjectCommand,
        PutObjectCommand,
      });
      report.add('MinIO', 'OK', 'Test object write/read/delete');
      return { dependencyOk: true, ok: true };
    } catch (error) {
      report.add('MinIO', 'ERROR', formatError(error));
      return { dependencyOk: true, ok: false };
    }
  } finally {
    client.destroy();
  }
}

export function createS3Client({ config, S3Client }) {
  return new S3Client({
    credentials: {
      accessKeyId: config.minio.accessKey,
      secretAccessKey: config.minio.secretKey,
    },
    endpoint: config.minio.endpoint,
    forcePathStyle: true,
    region: config.minio.region,
  });
}

export function createMinioProcessEnv(config) {
  const {
    MINIO_ACCESS_KEY,
    MINIO_SECRET_KEY,
    ...envWithoutDeprecatedMinioCredentials
  } = process.env;

  return {
    ...envWithoutDeprecatedMinioCredentials,
    MINIO_ROOT_PASSWORD: config.minio.rootPassword,
    MINIO_ROOT_USER: config.minio.rootUser,
  };
}

export async function checkMinioReady({ config }) {
  try {
    const response = await fetch(config.minio.endpoint, {
      signal: AbortSignal.timeout(3_000),
    });

    return response.status < 500
      ? { ok: true }
      : { message: `HTTP status ${response.status}`, ok: false };
  } catch (error) {
    return { message: formatError(error), ok: false };
  }
}

export async function waitForMinio(timeoutMs, { config }) {
  const startedAt = Date.now();
  let lastError = null;

  do {
    const ready = await checkMinioReady({ config });

    if (ready.ok) {
      return ready;
    }

    lastError = ready.message;
    await delay(1_000);
  } while (Date.now() - startedAt < timeoutMs);

  return { message: lastError ?? 'API did not become ready', ok: false };
}

export async function checkMinioObjectRoundtrip(
  client,
  { config, DeleteObjectCommand, GetObjectCommand, PutObjectCommand },
) {
  const key = `doctor/${Date.now()}-test.txt`;
  const body = `esoft doctor ${Date.now()}`;

  try {
    await client.send(
      new PutObjectCommand({
        Body: body,
        Bucket: config.minio.bucket,
        Key: key,
      }),
    );

    const object = await client.send(
      new GetObjectCommand({
        Bucket: config.minio.bucket,
        Key: key,
      }),
    );
    const received = await object.Body.transformToString();

    if (received !== body) {
      throw new Error('Test object content mismatch.');
    }
  } finally {
    await client
      .send(
        new DeleteObjectCommand({
          Bucket: config.minio.bucket,
          Key: key,
        }),
      )
      .catch(() => undefined);
  }
}
