import assert from 'node:assert/strict';
import test from 'node:test';

import {
  normalizePreDeployMigrationStatus,
  runProductionSetup,
} from '../../../scripts/prod/setup-prod.mjs';
import { loadProductionConfig } from '../../../scripts/prod/setup-prod.config.mjs';
import { failure, success } from '../../../scripts/infrastructure/result.mjs';
import {
  assertNoSecretLeak,
  assertOperationResult,
  SECRET_MARKERS,
} from '../helpers/operation-result.mjs';

test('setup:prod successful flow calls stages in the expected order', async () => {
  const calls = [];
  const result = await runProductionSetup({
    ...createTestRuntime(),
    operations: createOperations({
      calls,
      migrationStatuses: [
        failure(
          'PRISMA_MIGRATIONS_PENDING',
          'Prisma migrations are pending',
        ),
        success('PRISMA_MIGRATIONS_APPLIED', 'Prisma migrations are applied'),
      ],
    }),
  });

  assertOperationResult(result, { ok: true });
  assert.equal(result.code, 'PROD_SETUP_OK');
  assert.deepEqual(calls, [
    'loadProductionConfig',
    'checkPostgresConnection',
    'generatePrismaClient',
    'checkPrismaMigrationStatus',
    'deployPrismaMigrations',
    'checkPrismaMigrationStatus',
    'seedDatabase',
    'ensureStorageBucket',
  ]);
});

test('setup:prod stops before DB mutations when production mode guard fails', async () => {
  const calls = [];
  const output = createOutput();

  const result = await runProductionSetup({
    ...createTestRuntime({ output }),
    operations: createOperations({
      calls,
      loadProductionConfig: () => ({
        result: failure(
          'PROD_MODE_REQUIRED',
          `Production mode requires NODE_ENV=production. ${SECRET_MARKERS[0]}`,
        ),
      }),
    }),
  });

  assertOperationResult(result, { ok: false });
  assert.equal(result.details.failedCode, 'PROD_MODE_REQUIRED');
  assert.deepEqual(calls, ['loadProductionConfig']);
  assertNoSecretLeak(output.lines);
  assertNoSecretLeak(result);
});

test('loadProductionConfig reports production guard after valid non-production config', async () => {
  const loaded = await loadProductionConfig({
    loadConfig: () => ({
      config: {
        nodeEnv: 'development',
      },
      envPath: 'C:/project/.env',
      projectRoot: 'C:/project',
    }),
    projectRoot: 'C:/project',
    validateConfig: () => ({
      envPath: 'C:/project/.env',
      errors: [],
      valid: true,
      warnings: [],
    }),
  });

  assertOperationResult(loaded.result, { ok: false });
  assert.equal(loaded.result.code, 'PROD_MODE_REQUIRED');
});

test('setup:prod does not run migrations when PostgreSQL is unavailable', async () => {
  const calls = [];
  const result = await runProductionSetup({
    ...createTestRuntime(),
    operations: createOperations({
      calls,
      checkPostgresConnection: () =>
        failure('POSTGRES_CONNECTION_FAILED', 'Unable to connect'),
    }),
  });

  assertOperationResult(result, { ok: false });
  assert.equal(result.details.failedCode, 'POSTGRES_CONNECTION_FAILED');
  assert.deepEqual(calls, ['loadProductionConfig', 'checkPostgresConnection']);
});

test('setup:prod stops after migrate deploy failure', async () => {
  const calls = [];
  const result = await runProductionSetup({
    ...createTestRuntime(),
    operations: createOperations({
      calls,
      deployPrismaMigrations: () =>
        failure('PRISMA_MIGRATION_DEPLOY_FAILED', 'Deploy failed'),
    }),
  });

  assertOperationResult(result, { ok: false });
  assert.equal(result.details.failedCode, 'PRISMA_MIGRATION_DEPLOY_FAILED');
  assert.deepEqual(calls, [
    'loadProductionConfig',
    'checkPostgresConnection',
    'generatePrismaClient',
    'checkPrismaMigrationStatus',
    'deployPrismaMigrations',
  ]);
});

test('setup:prod stops when final migration status fails after deploy', async () => {
  const calls = [];
  const result = await runProductionSetup({
    ...createTestRuntime(),
    operations: createOperations({
      calls,
      migrationStatuses: [
        success('PRISMA_MIGRATIONS_APPLIED', 'Prisma migrations are applied'),
        failure(
          'PRISMA_MIGRATIONS_FAILED',
          'Prisma has failed migrations',
        ),
      ],
    }),
  });

  assertOperationResult(result, { ok: false });
  assert.equal(result.details.failedCode, 'PRISMA_MIGRATIONS_FAILED');
  assert.deepEqual(calls, [
    'loadProductionConfig',
    'checkPostgresConnection',
    'generatePrismaClient',
    'checkPrismaMigrationStatus',
    'deployPrismaMigrations',
    'checkPrismaMigrationStatus',
  ]);
});

test('setup:prod stops after seed failure before checking MinIO', async () => {
  const calls = [];
  const result = await runProductionSetup({
    ...createTestRuntime(),
    operations: createOperations({
      calls,
      seedDatabase: () => failure('PRISMA_SEED_FAILED', 'Seed failed'),
    }),
  });

  assertOperationResult(result, { ok: false });
  assert.equal(result.details.failedCode, 'PRISMA_SEED_FAILED');
  assert.deepEqual(calls, [
    'loadProductionConfig',
    'checkPostgresConnection',
    'generatePrismaClient',
    'checkPrismaMigrationStatus',
    'deployPrismaMigrations',
    'checkPrismaMigrationStatus',
    'seedDatabase',
  ]);
});

test('setup:prod maps thrown operation exceptions to stage failure', async () => {
  const calls = [];
  const result = await runProductionSetup({
    ...createTestRuntime(),
    operations: createOperations({
      calls,
      generatePrismaClient: () => {
        throw new Error('boom');
      },
    }),
  });

  assertOperationResult(result, { ok: false });
  assert.equal(result.details.failedCode, 'PROD_SETUP_STAGE_FAILED');
  assert.deepEqual(calls, [
    'loadProductionConfig',
    'checkPostgresConnection',
    'generatePrismaClient',
  ]);
});

test('setup:prod treats an existing MinIO bucket as successful and idempotent', async () => {
  const calls = [];
  const result = await runProductionSetup({
    ...createTestRuntime(),
    operations: createOperations({
      calls,
      ensureStorageBucket: () =>
        success('MINIO_BUCKET_AVAILABLE', 'MinIO bucket is available'),
    }),
  });

  assertOperationResult(result, { ok: true });
  assert.equal(result.code, 'PROD_SETUP_OK');
  assert.equal(calls.at(-1), 'ensureStorageBucket');
});

test('setup:prod does not leak secrets from command diagnostics', async () => {
  const output = createOutput();
  const result = await runProductionSetup({
    ...createTestRuntime({ output }),
    operations: createOperations({
      generatePrismaClient: () =>
        failure('PRISMA_CLIENT_GENERATION_FAILED', 'Generate failed', {
          stderr: `DATABASE_URL=${SECRET_MARKERS[0]}`,
          stdout: `MINIO_SECRET_KEY=${SECRET_MARKERS[1]}`,
        }),
    }),
  });

  assertOperationResult(result, { ok: false });
  assertNoSecretLeak(result);
  assertNoSecretLeak(output.lines);
});

test('normalizePreDeployMigrationStatus allows pending migrations before deploy', () => {
  const result = normalizePreDeployMigrationStatus(
    failure('PRISMA_MIGRATIONS_PENDING', 'Prisma migrations are pending'),
  );

  assertOperationResult(result, { ok: true });
  assert.equal(result.code, 'PRISMA_MIGRATIONS_PENDING');
});

function createOperations(overrides = {}) {
  const calls = overrides.calls ?? [];
  const migrationStatuses = overrides.migrationStatuses ?? [
    success('PRISMA_MIGRATIONS_APPLIED', 'Prisma migrations are applied'),
    success('PRISMA_MIGRATIONS_APPLIED', 'Prisma migrations are applied'),
  ];

  const operation = (name, defaultResult) => async () => {
    calls.push(name);
    return typeof overrides[name] === 'function'
      ? overrides[name]()
      : defaultResult;
  };

  return {
    loadProductionConfig: async () => {
      calls.push('loadProductionConfig');

      if (typeof overrides.loadProductionConfig === 'function') {
        return overrides.loadProductionConfig();
      }

      return {
        config: createConfig(),
        projectRoot: 'C:/project',
        result: success('PROD_CONFIG_OK', 'Production configuration is valid'),
      };
    },
    checkPostgresConnection: operation(
      'checkPostgresConnection',
      success('POSTGRES_CONNECTION_OK', 'PostgreSQL connection is available'),
    ),
    generatePrismaClient: operation(
      'generatePrismaClient',
      success('PRISMA_CLIENT_GENERATED', 'Prisma Client generated'),
    ),
    checkPrismaMigrationStatus: async () => {
      calls.push('checkPrismaMigrationStatus');
      return migrationStatuses.shift();
    },
    deployPrismaMigrations: operation(
      'deployPrismaMigrations',
      success('PRISMA_MIGRATIONS_DEPLOYED', 'Prisma migrations deployed'),
    ),
    seedDatabase: operation(
      'seedDatabase',
      success('PRISMA_SEED_OK', 'Database seed completed'),
    ),
    ensureStorageBucket: operation(
      'ensureStorageBucket',
      success('MINIO_BUCKET_CREATED', 'MinIO bucket was created'),
    ),
  };
}

function createTestRuntime({ output = createOutput() } = {}) {
  return {
    npm: 'npm',
    output,
    projectRoot: 'C:/project',
    runCommand: async () => {
      throw new Error('runCommand should be mocked by operations');
    },
    runtimeDependencies: {
      CreateBucketCommand: class CreateBucketCommand {},
      HeadBucketCommand: class HeadBucketCommand {},
      PgClient: class PgClient {},
      S3Client: class S3Client {},
    },
  };
}

function createOutput() {
  const lines = [];

  return {
    lines,
    log(value = '') {
      lines.push(String(value));
    },
  };
}

function createConfig() {
  return {
    database: {
      url: 'postgresql://user:[redacted]@localhost:5432/esoft',
    },
    minio: {
      accessKey: '[redacted]',
      bucket: 'esoft',
      endpoint: 'http://localhost:9000',
      region: 'us-east-1',
      secretKey: '[redacted]',
    },
    nodeEnv: 'production',
  };
}
