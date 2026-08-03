import assert from 'node:assert/strict';
import test from 'node:test';

import { runProductionDoctor } from '../../../scripts/prod/doctor-prod.mjs';
import { success, failure } from '../../../scripts/infrastructure/result.mjs';
import {
  assertNoSecretLeak,
  assertOperationResult,
  SECRET_MARKERS,
} from '../helpers/operation-result.mjs';
import { createTemporaryProject } from '../helpers/temporary-project.mjs';

class HeadBucketCommand {
  constructor(input) {
    this.input = input;
  }
}

test('doctor:prod happy path reports production environment ready', async () => {
  const calls = [];
  const result = await runProductionDoctor({
    ...createTestRuntime(),
    operations: createOperations({ calls }),
  });

  assertOperationResult(result, { ok: true });
  assert.equal(result.code, 'PROD_DOCTOR_OK');
  assert.deepEqual(calls, [
    'loadProductionConfig',
    'checkPostgresConnection',
    'checkPrismaMigrationStatus',
    'checkStorageBucket',
    'checkBackendBuild',
    'checkFrontendBuild',
  ]);
});

test('doctor:prod skips config-dependent checks when production config is invalid', async () => {
  const calls = [];
  const output = createOutput();
  const result = await runProductionDoctor({
    ...createTestRuntime({ output }),
    operations: createOperations({
      calls,
      loadProductionConfig: () => ({
        result: failure(
          'PROD_CONFIG_INVALID',
          `Production configuration is invalid DATABASE_URL=${SECRET_MARKERS[0]}`,
        ),
      }),
    }),
  });

  assertOperationResult(result, { ok: false });
  assert.equal(result.code, 'PROD_DOCTOR_FAILED');
  assert.deepEqual(calls, [
    'loadProductionConfig',
    'checkBackendBuild',
    'checkFrontendBuild',
  ]);
  assert.equal(
    result.details.checks.filter(
      (check) => check.result.code === 'PROD_DOCTOR_CHECK_SKIPPED',
    ).length,
    3,
  );
  assertNoSecretLeak(result);
  assertNoSecretLeak(output.lines);
});

test('doctor:prod continues independent checks after PostgreSQL failure', async () => {
  const calls = [];
  const result = await runProductionDoctor({
    ...createTestRuntime(),
    operations: createOperations({
      calls,
      checkPostgresConnection: () =>
        failure('POSTGRES_CONNECTION_FAILED', 'Unable to connect'),
    }),
  });

  assertOperationResult(result, { ok: false });
  assert.equal(result.code, 'PROD_DOCTOR_FAILED');
  assert.deepEqual(calls, [
    'loadProductionConfig',
    'checkPostgresConnection',
    'checkPrismaMigrationStatus',
    'checkStorageBucket',
    'checkBackendBuild',
    'checkFrontendBuild',
  ]);
});

test('doctor:prod treats pending Prisma migrations as not ready without deploy', async () => {
  const calls = [];
  const result = await runProductionDoctor({
    ...createTestRuntime(),
    operations: createOperations({
      calls,
      checkPrismaMigrationStatus: () =>
        failure('PRISMA_MIGRATIONS_PENDING', 'Prisma migrations are pending'),
      deployPrismaMigrations: () => {
        throw new Error('deploy must not run');
      },
    }),
  });

  assertOperationResult(result, { ok: false });
  assert.equal(
    result.details.checks.some(
      (check) => check.result.code === 'PRISMA_MIGRATIONS_PENDING',
    ),
    true,
  );
  assert.equal(calls.includes('deployPrismaMigrations'), false);
});

test('doctor:prod checks MinIO bucket without creating missing bucket', async () => {
  const calls = [];
  const commands = [];
  class S3Client {
    destroy() {
      calls.push('destroyS3Client');
    }

    async send(command) {
      commands.push(command);
      const error = new Error('missing bucket');
      error.$metadata = { httpStatusCode: 404 };
      throw error;
    }
  }

  const result = await runProductionDoctor({
    ...createTestRuntime(),
    operations: createOperations({
      calls,
      checkStorageBucket: undefined,
    }),
    runtimeDependencies: {
      HeadBucketCommand,
      PgClient: class PgClient {},
      S3Client,
    },
  });

  assertOperationResult(result, { ok: false });
  assert.equal(
    result.details.checks.some(
      (check) => check.result.code === 'MINIO_BUCKET_MISSING',
    ),
    true,
  );
  assert.equal(commands.length, 1);
  assert.equal(commands[0] instanceof HeadBucketCommand, true);
  assert.deepEqual(commands[0].input, { Bucket: 'esoft' });
  assert.equal(calls.includes('destroyS3Client'), true);
});

test('doctor:prod fails when backend build is missing', async () => {
  const project = await createTemporaryProject();

  try {
    const result = await runProductionDoctor({
      ...createTestRuntime({ projectRoot: project.root }),
      operations: createOperations({
        checkBackendBuild: undefined,
        loadProductionConfig: () => createLoadedConfig({ projectRoot: project.root }),
      }),
    });

    assertOperationResult(result, { ok: false });
    assert.equal(
      result.details.checks.some(
        (check) => check.result.code === 'PROD_BACKEND_BUILD_MISSING',
      ),
      true,
    );
  } finally {
    await project.remove();
  }
});

test('doctor:prod accepts backend/dist/src/main.js as backend build artifact', async () => {
  const project = await createTemporaryProject({
    'backend/dist/src/main.js': 'console.log("ready");',
  });

  try {
    const result = await runProductionDoctor({
      ...createTestRuntime({ projectRoot: project.root }),
      operations: createOperations({
        checkBackendBuild: undefined,
        loadProductionConfig: () => createLoadedConfig({ projectRoot: project.root }),
      }),
    });

    assertOperationResult(result, { ok: true });
  } finally {
    await project.remove();
  }
});

test('doctor:prod fails when frontend build is missing', async () => {
  const project = await createTemporaryProject();

  try {
    const result = await runProductionDoctor({
      ...createTestRuntime({ projectRoot: project.root }),
      operations: createOperations({
        checkFrontendBuild: undefined,
        loadProductionConfig: () => createLoadedConfig({ projectRoot: project.root }),
      }),
    });

    assertOperationResult(result, { ok: false });
    assert.equal(
      result.details.checks.some(
        (check) => check.result.code === 'PROD_FRONTEND_BUILD_MISSING',
      ),
      true,
    );
  } finally {
    await project.remove();
  }
});

test('doctor:prod reports multiple independent failures', async () => {
  const result = await runProductionDoctor({
    ...createTestRuntime(),
    operations: createOperations({
      checkPostgresConnection: () =>
        failure('POSTGRES_CONNECTION_FAILED', 'Unable to connect'),
      checkFrontendBuild: () =>
        failure('PROD_FRONTEND_BUILD_MISSING', 'Frontend build is missing'),
    }),
  });

  assertOperationResult(result, { ok: false });
  assert.equal(
    result.details.checks.some(
      (check) => check.result.code === 'POSTGRES_CONNECTION_FAILED',
    ),
    true,
  );
  assert.equal(
    result.details.checks.some(
      (check) => check.result.code === 'PROD_FRONTEND_BUILD_MISSING',
    ),
    true,
  );
});

test('doctor:prod maps thrown check exceptions and continues', async () => {
  const calls = [];
  const result = await runProductionDoctor({
    ...createTestRuntime(),
    operations: createOperations({
      calls,
      checkPostgresConnection: () => {
        throw new Error('boom');
      },
    }),
  });

  assertOperationResult(result, { ok: false });
  assert.equal(
    result.details.checks.some(
      (check) => check.result.code === 'PROD_DOCTOR_CHECK_FAILED',
    ),
    true,
  );
  assert.deepEqual(calls, [
    'loadProductionConfig',
    'checkPostgresConnection',
    'checkPrismaMigrationStatus',
    'checkStorageBucket',
    'checkBackendBuild',
    'checkFrontendBuild',
  ]);
});

test('doctor:prod does not leak secrets from output or final result', async () => {
  const output = createOutput();
  const result = await runProductionDoctor({
    ...createTestRuntime({ output }),
    operations: createOperations({
      checkPostgresConnection: () =>
        failure(
          'POSTGRES_CONNECTION_FAILED',
          `Unable to connect DATABASE_URL=${SECRET_MARKERS[0]}`,
        ),
      checkStorageBucket: () =>
        failure(
          'MINIO_ACCESS_DENIED',
          `Access denied MINIO_SECRET_KEY=${SECRET_MARKERS[1]}`,
        ),
    }),
  });

  assertOperationResult(result, { ok: false });
  assertNoSecretLeak(result);
  assertNoSecretLeak(output.lines);
});

function createOperations(overrides = {}) {
  const calls = overrides.calls ?? [];
  const operation = (name, defaultResult) => async () => {
    calls.push(name);

    if (typeof overrides[name] === 'function') {
      return overrides[name]();
    }

    return defaultResult;
  };
  const operations = {
    loadProductionConfig: async () => {
      calls.push('loadProductionConfig');

      if (typeof overrides.loadProductionConfig === 'function') {
        return overrides.loadProductionConfig();
      }

      return createLoadedConfig();
    },
    checkPostgresConnection: operation(
      'checkPostgresConnection',
      success('POSTGRES_CONNECTION_OK', 'PostgreSQL connection is available'),
    ),
    checkPrismaMigrationStatus: operation(
      'checkPrismaMigrationStatus',
      success('PRISMA_MIGRATIONS_APPLIED', 'Prisma migrations are applied'),
    ),
    checkStorageBucket: operation(
      'checkStorageBucket',
      success('MINIO_BUCKET_AVAILABLE', 'MinIO bucket is available'),
    ),
    checkBackendBuild: operation(
      'checkBackendBuild',
      success('PROD_BACKEND_BUILD_OK', 'Backend production build exists'),
    ),
    checkFrontendBuild: operation(
      'checkFrontendBuild',
      success('PROD_FRONTEND_BUILD_OK', 'Frontend production build exists'),
    ),
  };

  for (const [name, value] of Object.entries(overrides)) {
    if (value === undefined) {
      delete operations[name];
    }
  }

  return operations;
}

function createTestRuntime({
  output = createOutput(),
  projectRoot = 'C:/project',
} = {}) {
  return {
    npm: 'npm',
    output,
    projectRoot,
    runCommand: async () => {
      throw new Error('runCommand should be mocked by operations');
    },
    runtimeDependencies: {
      HeadBucketCommand,
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

function createLoadedConfig({ projectRoot = 'C:/project' } = {}) {
  return {
    config: createConfig(),
    env: {
      DATABASE_URL: 'postgresql://user:[redacted]@localhost:5432/esoft',
    },
    projectRoot,
    result: success('PROD_CONFIG_OK', 'Production configuration is valid'),
  };
}
