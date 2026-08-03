import assert from 'node:assert/strict';
import { chmod, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';

import { loadValidatedConfig } from '../../../../scripts/infrastructure/config/validated-config.mjs';
import { assertOperationResult } from '../../helpers/operation-result.mjs';
import {
  createTemporaryProject,
} from '../../helpers/temporary-project.mjs';
import { withEnvironment } from '../../helpers/environment.mjs';

test('loadValidatedConfig loads, validates and applies environment after success', async () => {
  await withEnvironment(async () => {
    const project = await createProjectWithEnv();

    try {
      const result = loadValidatedConfig({
        applyToProcessEnv: true,
        projectRoot: project.root,
      });

      assertOperationResult(result, { ok: true });
      assert.equal(result.code, 'CONFIG_VALID');
      assert.equal(result.details.config.backend.port, 3000);
      assert.equal(result.details.config.minio.endpoint, 'http://127.0.0.1:9000');
      assert.equal(
        result.details.config.backup.dir,
        join(project.root, 'backups'),
      );
      assert.equal(result.details.config.backup.pgDumpPath, null);
      assert.equal(result.details.config.backup.pgRestorePath, null);
      assert.equal(result.details.envPath, join(project.root, '.env'));
      assert.equal(result.details.projectRoot, project.root);
      assert.equal('env' in result.details, false);
      assert.equal(process.env.BACKEND_PORT, '3000');
      assert.equal(process.env.DATABASE_URL, project.env.DATABASE_URL);
      assert.equal(process.env.MINIO_BUCKET, 'esoft');
    } finally {
      await project.remove();
    }
  });
});

test('loadValidatedConfig does not modify process.env by default', async () => {
  await withEnvironment(async () => {
    process.env.BACKEND_PORT = 'original';
    process.env.DATABASE_URL = 'original-database-url';
    process.env.MINIO_BUCKET = 'original-bucket';
    const project = await createProjectWithEnv();

    try {
      const result = loadValidatedConfig({
        projectRoot: project.root,
      });

      assertOperationResult(result, { ok: true });
      assert.equal(result.code, 'CONFIG_VALID');
      assert.equal(result.details.config.backend.port, 3000);
      assert.equal(process.env.BACKEND_PORT, 'original');
      assert.equal(process.env.DATABASE_URL, 'original-database-url');
      assert.equal(process.env.MINIO_BUCKET, 'original-bucket');
    } finally {
      await project.remove();
    }
  });
});

test('loadValidatedConfig allows missing optional backup variables', async () => {
  const project = await createProjectWithEnv({
    BACKUP_DIR: undefined,
    PG_DUMP_PATH: undefined,
    PG_RESTORE_PATH: undefined,
  });

  try {
    const result = loadValidatedConfig({
      projectRoot: project.root,
    });

    assertOperationResult(result, { ok: true });
    assert.equal(result.details.config.backup.dir, null);
    assert.equal(result.details.config.backup.pgDumpPath, null);
    assert.equal(result.details.config.backup.pgRestorePath, null);
  } finally {
    await project.remove();
  }
});

test('loadValidatedConfig does not apply invalid environment to process.env', async () => {
  await withEnvironment(async () => {
    process.env.BACKEND_PORT = 'original-backend-port';
    process.env.FRONTEND_PORT = 'original-frontend-port';
    process.env.MINIO_BUCKET = 'original-bucket';
    process.env.BETTER_AUTH_SECRET = 'original-secret';
    const project = await createProjectWithEnv({
      BACKEND_PORT: 'invalid-port',
      BACKEND_URL: 'http://127.0.0.1:invalid-port',
    });

    try {
      const result = loadValidatedConfig({
        applyToProcessEnv: true,
        projectRoot: project.root,
      });

      assertOperationResult(result, { ok: false });
      assert.equal(result.code, 'CONFIG_INVALID');
      assert.equal(process.env.BACKEND_PORT, 'original-backend-port');
      assert.equal(process.env.FRONTEND_PORT, 'original-frontend-port');
      assert.equal(process.env.MINIO_BUCKET, 'original-bucket');
      assert.equal(process.env.BETTER_AUTH_SECRET, 'original-secret');
      assert.equal(
        result.details.errors.some((error) => error.variable === 'BACKEND_PORT'),
        true,
      );
    } finally {
      await project.remove();
    }
  });
});

test('loadValidatedConfig reports missing root .env file', async () => {
  const project = await createTemporaryProject();

  try {
    const result = loadValidatedConfig({
      projectRoot: project.root,
    });

    assertOperationResult(result, { ok: false });
    assert.equal(result.code, 'CONFIG_ENV_FILE_MISSING');
    assert.equal(result.details.envPath, join(project.root, '.env'));
    assert.equal(result.details.projectRoot, project.root);
  } finally {
    await project.remove();
  }
});

async function createProjectWithEnv(overrides = {}) {
  const project = await createTemporaryProject({
    '.env': '',
    'tools/minio.exe': 'minio',
    'minio/.keep': '',
  });
  await chmod(join(project.root, 'tools/minio.exe'), 0o755);
  await mkdir(join(project.root, 'minio'), { recursive: true });
  const env = {
    NODE_ENV: 'development',
    BACKEND_HOST: '127.0.0.1',
    BACKEND_PORT: '3000',
    BACKEND_URL: 'http://127.0.0.1:3000',
    FRONTEND_HOST: '127.0.0.1',
    FRONTEND_PORT: '5173',
    FRONTEND_URL: 'http://127.0.0.1:5173',
    VITE_API_URL: 'http://127.0.0.1:3000',
    DATABASE_URL: 'postgresql://esoft:db_password@127.0.0.1:5432/esoft',
    BETTER_AUTH_SECRET: 'local_test_secret_value',
    BETTER_AUTH_URL: 'http://127.0.0.1:3000',
    MINIO_HOST: '127.0.0.1',
    MINIO_PORT: '9000',
    MINIO_CONSOLE_PORT: '9001',
    MINIO_USE_SSL: 'false',
    MINIO_ROOT_USER: 'esoft',
    MINIO_ROOT_PASSWORD: 'esoft_password',
    MINIO_ACCESS_KEY: 'esoft_access',
    MINIO_SECRET_KEY: 'esoft_secret',
    MINIO_BUCKET: 'esoft',
    MINIO_EXECUTABLE: join(project.root, 'tools/minio.exe'),
    MINIO_DATA_DIR: join(project.root, 'minio'),
    BACKUP_DIR: join(project.root, 'backups'),
    ...overrides,
  };

  await writeFile(
    join(project.root, '.env'),
    Object.entries(env)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => `${key}=${value}`)
      .join('\n'),
  );

  return {
    ...project,
    env,
  };
}
