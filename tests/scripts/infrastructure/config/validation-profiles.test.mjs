import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';

import { loadValidatedConfig } from '../../../../scripts/infrastructure/config/validated-config.mjs';
import { loadProductionConfig } from '../../../../scripts/prod/setup-prod.config.mjs';
import { loadProductionBackupConfig } from '../../../../scripts/prod/backup-prod.config.mjs';
import { loadProductionRestoreConfig } from '../../../../scripts/prod/restore-prod.config.mjs';
import { createTemporaryProject } from '../../helpers/temporary-project.mjs';

const require = createRequire(import.meta.url);
const core = require('../../../../scripts/config/config-core.cjs');
const runtime = {
  NODE_ENV: 'production',
  BACKEND_HOST: '127.0.0.1',
  BACKEND_PORT: '3000',
  BACKEND_URL: 'https://esoft.example',
  FRONTEND_URL: 'https://esoft.example',
  DATABASE_URL: 'postgresql://app:strong-password@127.0.0.1:5432/esoft',
  BETTER_AUTH_SECRET: 'abcdefghijklmnopqrstuvwxyz0123456789',
  BETTER_AUTH_URL: 'https://esoft.example',
  MINIO_HOST: 'storage.example',
  MINIO_PORT: '3000',
  MINIO_USE_SSL: 'true',
  MINIO_ACCESS_KEY: 'app-storage-key',
  MINIO_SECRET_KEY: 'app-storage-secret',
  MINIO_BUCKET: 'esoft',
};

test('backup and restore load only database and storage configuration', async () => {
  const env = Object.fromEntries(core.requiredVariables.map((name) => [name, '']));
  const { getValidationProfile } = require('../../../../scripts/config/core/validation-profiles.cjs');
  for (const name of getValidationProfile('storage-operation').required)
    env[name] = runtime[name];
  env.BETTER_AUTH_SECRET = 'change_me';
  const project = await createTemporaryProject({
    '.env': Object.entries(env).map(([key, value]) => `${key}=${value}`).join('\n'),
  });
  try {
    const options = { projectRoot: project.root, applyToProcessEnv: false };
    const restored = await loadProductionRestoreConfig(options);
    assert.equal(restored.result.ok, true, JSON.stringify(restored.result));
    assert.equal(restored.config.auth.secret, undefined);
    const backedUp = await loadProductionBackupConfig(options);
    assert.equal(backedUp.result.details.variable, 'BACKUP_DIR');
    assert.equal((await loadProductionConfig(options)).result.ok, false);
    const invalid = core.validateEnvironment({ ...env, MINIO_SECRET_KEY: '' }, { profile: 'storage-operation' });
    assert.equal(invalid.valid, false);
    assert.ok(invalid.errors.some(({ variable }) => variable === 'MINIO_SECRET_KEY'));
  } finally {
    await project.remove();
  }
});

for (const profile of ['backend', 'production']) {
  test(`${profile} accepts remote storage without local MinIO or frontend listeners`, () => {
    const env = {
      ...runtime,
      VITE_API_URL: 'https://esoft.example',
      MINIO_EXECUTABLE: '/missing/minio',
      MINIO_DATA_DIR: '/missing/data',
      MINIO_ROOT_PASSWORD: 'change_me',
      MINIO_CONSOLE_PORT: 'invalid',
    };
    const result = core.validateEnvironment(env, { profile });
    assert.equal(result.valid, true, JSON.stringify(result));
    const config = core.buildConfig(env, { profile });
    assert.equal(config.minio.rootPassword, undefined);
    assert.equal(config.minio.executable, undefined);
    assert.equal(config.frontend.internalUrl, undefined);
  });
}

test('backend still rejects missing database credentials and invalid public origins', () => {
  const result = core.validateEnvironment(
    {
      ...runtime,
      DATABASE_URL: '',
      BETTER_AUTH_URL: 'https://user:pass@esoft.example/path',
    },
    { profile: 'backend' },
  );
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.variable === 'DATABASE_URL'));
  assert.ok(
    result.errors.some((error) => error.variable === 'BETTER_AUTH_URL'),
  );
});

test('frontend requires its own listeners and API URL, without database, auth or S3', () => {
  const env = {
    NODE_ENV: 'development',
    BACKEND_HOST: '127.0.0.1',
    BACKEND_PORT: '3000',
    BACKEND_URL: 'http://127.0.0.1:3000',
    FRONTEND_HOST: '127.0.0.1',
    FRONTEND_PORT: '5173',
    FRONTEND_URL: 'http://127.0.0.1:5173',
    VITE_API_URL: 'http://127.0.0.1:3000',
  };
  assert.equal(
    core.validateEnvironment(env, { profile: 'frontend' }).valid,
    true,
  );
  const invalid = core.validateEnvironment(
    { ...env, VITE_API_URL: 'invalid' },
    { profile: 'frontend' },
  );
  assert.ok(invalid.errors.some((error) => error.variable === 'VITE_API_URL'));
  const conflicting = core.validateEnvironment(
    { ...env, FRONTEND_PORT: '3000' },
    { profile: 'frontend' },
  );
  assert.equal(conflicting.valid, false);
});

test('local profile retains server credentials and executable requirements', () => {
  const result = core.validateEnvironment(runtime);
  assert.equal(result.valid, false);
  for (const variable of [
    'MINIO_ROOT_USER',
    'MINIO_ROOT_PASSWORD',
    'MINIO_EXECUTABLE',
    'MINIO_DATA_DIR',
    'MINIO_CONSOLE_PORT',
  ])
    assert.ok(
      result.errors.some((error) => error.variable === variable),
      variable,
    );
});

test('unknown profiles fail closed', () => {
  const result = core.validateEnvironment(runtime, { profile: 'unknown' });
  assert.equal(result.valid, false);
  assert.equal(result.errors[0].variable, 'CONFIG_PROFILE');
});

test('database tools need only PostgreSQL configuration', () => {
  const env = { NODE_ENV: 'production', DATABASE_URL: runtime.DATABASE_URL };
  assert.equal(
    core.validateEnvironment(env, { profile: 'database' }).valid,
    true,
  );
  assert.equal(
    core.buildConfig(env, { profile: 'database' }).database.url,
    env.DATABASE_URL,
  );
  assert.equal(
    core.validateEnvironment(
      { ...env, DATABASE_URL: '' },
      { profile: 'database' },
    ).valid,
    false,
  );
});

test('backend ignores backup utilities while production validates configured paths', () => {
  const env = {
    ...runtime,
    VITE_API_URL: 'https://esoft.example',
    PG_DUMP_PATH: '/nonexistent/pg_dump',
  };
  assert.equal(
    core.validateEnvironment(env, { profile: 'backend' }).valid,
    true,
  );
  assert.ok(
    core
      .validateEnvironment(env, { profile: 'production' })
      .errors.some((error) => error.variable === 'PG_DUMP_PATH'),
  );
});

test('all configuration loaders propagate the selected profile', async () => {
  const env = Object.fromEntries(
    core.requiredVariables.map((name) => [name, '']),
  );
  Object.assign(env, runtime, { VITE_API_URL: 'https://esoft.example' });
  const project = await createTemporaryProject({
    '.env': Object.entries(env)
      .map(([key, value]) => `${key}=${value}`)
      .join('\n'),
  });
  try {
    assert.equal(
      core.validateConfig({ projectRoot: project.root, profile: 'backend' })
        .valid,
      true,
    );
    assert.equal(
      core.loadConfig({ projectRoot: project.root, profile: 'backend' }).config
        .minio.endpoint,
      'https://storage.example:3000',
    );
    assert.equal(
      loadValidatedConfig({ projectRoot: project.root, profile: 'backend' }).ok,
      true,
    );
    assert.equal(
      (
        await loadProductionConfig({
          projectRoot: project.root,
          applyToProcessEnv: false,
        })
      ).result.ok,
      true,
    );
    assert.equal(
      core.validateConfig({ projectRoot: project.root }).valid,
      false,
    );
  } finally {
    await project.remove();
  }
});
