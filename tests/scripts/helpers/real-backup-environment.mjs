import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { createServer } from 'node:net';
import { access, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';

import { runCommand } from '../../../scripts/infrastructure/commands/run-command.mjs';
import { loadRuntimeDependencies } from '../../../scripts/prod/restore-prod.operations.mjs';

const require = createRequire(import.meta.url);
const { loadEnvironment } = require('../../../scripts/config/config-core.cjs');
const backendRequire = createRequire(resolve('backend/package.json'));
const { CreateBucketCommand, GetObjectCommand, PutObjectCommand, S3Client } =
  backendRequire('@aws-sdk/client-s3');

async function freePort() {
  const server = createServer();
  await new Promise((ok, fail) => {
    server.once('error', fail);
    server.listen(0, '127.0.0.1', ok);
  });
  const port = server.address().port;
  await new Promise((ok, fail) =>
    server.close((error) => (error ? fail(error) : ok())),
  );
  return port;
}

async function command(executable, args) {
  if (basename(executable).startsWith('pg_ctl')) {
    // PostgreSQL children on Windows can inherit captured pipes after pg_ctl exits.
    // A service launcher must not wait for those background pipes to close.
    await new Promise((ok, fail) => {
      const child = spawn(executable, args, {
        stdio: 'ignore',
        windowsHide: true,
      });
      const timer = setTimeout(() => {
        child.kill();
        fail(new Error('Isolated pg_ctl timeout'));
      }, 30000);
      child.once('error', (error) => {
        clearTimeout(timer);
        fail(error);
      });
      child.once('exit', (code) => {
        clearTimeout(timer);
        code === 0
          ? ok()
          : fail(new Error(`Isolated pg_ctl failed with code ${code}`));
      });
    });
    return;
  }
  const result = await runCommand(executable, args, { timeoutMs: 30000 });
  if (!result.ok)
    throw new Error(
      `Isolated test command failed: ${basename(executable)}: ${result.stderr || result.stdout}`,
    );
}

async function stopChild(child) {
  if (!child?.pid || child.exitCode !== null || child.signalCode !== null)
    return;
  await new Promise((ok, fail) => {
    const timer = setTimeout(
      () => fail(new Error('Isolated MinIO did not stop')),
      10000,
    );
    child.once('exit', () => {
      clearTimeout(timer);
      ok();
    });
    child.kill('SIGTERM');
  });
}

export async function createRealBackupEnvironment() {
  const { env } = loadEnvironment({ applyToProcessEnv: false });
  const pgBin =
    process.env.ESOFT_TEST_PG_BIN ||
    dirname(
      env.PG_DUMP_PATH ||
        'C:/Program Files/PostgreSQL/17/bin/pg_dump.exe',
    );
  const exe = (name) =>
    join(pgBin, process.platform === 'win32' ? `${name}.exe` : name);
  const minioExecutable =
    process.env.ESOFT_TEST_MINIO_EXE || env.MINIO_EXECUTABLE || resolve('tools/minio.exe');
  for (const path of [
    exe('initdb'),
    exe('pg_ctl'),
    exe('pg_dump'),
    exe('pg_restore'),
    minioExecutable,
  ])
    await access(path);
  const runtimeDependencies = loadRuntimeDependencies();
  const pgPort = await freePort();
  let apiPort = await freePort();
  while (apiPort === pgPort) apiPort = await freePort();
  let consolePort = await freePort();
  while (consolePort === apiPort || consolePort === pgPort)
    consolePort = await freePort();
  const root = await mkdtemp(join(tmpdir(), 'esoft-backup-probe-'));
  const data = join(root, 'postgres');
  let postgresStarted = false;
  let minio;
  let database;
  let storage;
  let removed = false;
  const config = {
    nodeEnv: 'production',
    backup: {
      dir: join(root, 'backups'),
      pgDumpPath: exe('pg_dump'),
      pgRestorePath: exe('pg_restore'),
    },
    database: { url: `postgresql://esoft_verify@127.0.0.1:${pgPort}/postgres` },
    minio: {
      endpoint: `http://127.0.0.1:${apiPort}`,
      bucket: `restore-probe-${randomUUID()}`,
      region: 'us-east-1',
      accessKey: `probe${randomUUID().replaceAll('-', '')}`,
      secretKey: randomUUID(),
    },
  };
  async function close() {
    if (removed) return;
    const errors = [];
    for (const stop of [
      () => database?.end(),
      () => storage?.destroy(),
      () => stopChild(minio),
      async () => {
        if (!postgresStarted) return;
        try {
          await access(join(data, 'postmaster.pid'));
        } catch (error) {
          if (error.code === 'ENOENT') return;
          throw error;
        }
        await command(exe('pg_ctl'), [
          '-D',
          data,
          '-m',
          'fast',
          '-w',
          '-t',
          '20',
          'stop',
        ]);
      },
    ]) {
      try {
        await stop();
      } catch (error) {
        errors.push(error);
      }
    }
    if (errors.length)
      throw new AggregateError(
        errors,
        `Isolated service cleanup failed; preserving ${root}`,
      );
    const target = resolve(root);
    if (
      dirname(target) !== resolve(tmpdir()) ||
      !basename(target).startsWith('esoft-backup-probe-')
    )
      throw new Error('Unsafe isolated cleanup target');
    await rm(target, { recursive: true, force: true });
    removed = true;
  }
  try {
    await writeFile(
      join(root, 'package.json'),
      JSON.stringify({ version: 'isolated-verification' }),
    );
    await command(exe('initdb'), [
      '-D',
      data,
      '-U',
      'esoft_verify',
      '-A',
      'trust',
      '--encoding=UTF8',
      '--no-locale',
    ]);
    postgresStarted = true;
    await command(exe('pg_ctl'), [
      '-D',
      data,
      '-l',
      join(root, 'postgres.log'),
      '-o',
      `-h 127.0.0.1 -p ${pgPort}`,
      '-w',
      '-t',
      '20',
      'start',
    ]);
    database = new runtimeDependencies.PgClient({
      connectionString: config.database.url,
      connectionTimeoutMillis: 3000,
    });
    await database.connect();
    const location = await database.query('SHOW data_directory');
    if (resolve(location.rows[0].data_directory) !== resolve(data))
      throw new Error('Connected to an unexpected PostgreSQL cluster');
    await mkdir(join(root, 'minio'));
    minio = spawn(
      minioExecutable,
      [
        'server',
        '--address',
        `127.0.0.1:${apiPort}`,
        '--console-address',
        `127.0.0.1:${consolePort}`,
        join(root, 'minio'),
      ],
      {
        env: {
          ...process.env,
          MINIO_ROOT_USER: config.minio.accessKey,
          MINIO_ROOT_PASSWORD: config.minio.secretKey,
        },
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    );
    let minioError;
    minio.on('error', (error) => {
      minioError = error;
    });
    minio.stdout.resume();
    minio.stderr.resume();
    const deadline = Date.now() + 20000;
    while (true) {
      if (minioError || minio.exitCode !== null || minio.signalCode !== null)
        throw new Error('Isolated MinIO startup failed');
      try {
        const response = await fetch(
          `${config.minio.endpoint}/minio/health/ready`,
          { signal: AbortSignal.timeout(1000) },
        );
        if (response.ok) break;
      } catch {
        /* Startup may still be in progress. */
      }
      if (Date.now() >= deadline)
        throw new Error('Isolated MinIO readiness timeout');
      await new Promise((ok) => setTimeout(ok, 100));
    }
    storage = new S3Client({
      endpoint: config.minio.endpoint,
      region: config.minio.region,
      forcePathStyle: true,
      credentials: {
        accessKeyId: config.minio.accessKey,
        secretAccessKey: config.minio.secretKey,
      },
    });
    await storage.send(
      new CreateBucketCommand({ Bucket: config.minio.bucket }),
    );
    return {
      root,
      config,
      database,
      runtimeDependencies,
      close,
      async put(key, content) {
        await storage.send(
          new PutObjectCommand({
            Bucket: config.minio.bucket,
            Key: key,
            Body: content,
          }),
        );
      },
      async get(key) {
        const response = await storage.send(
          new GetObjectCommand({ Bucket: config.minio.bucket, Key: key }),
        );
        return Buffer.from(await response.Body.transformToByteArray());
      },
    };
  } catch (error) {
    try {
      await close();
    } catch (cleanup) {
      throw new AggregateError(
        [error, cleanup],
        `Isolated test failed; resources may remain under ${root}`,
      );
    }
    throw error;
  }
}
