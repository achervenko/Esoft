import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createDefaultSetupOperations,
  runInfrastructureSetup,
} from '../../../../scripts/infrastructure/setup/setup.mjs';
import { failure, success } from '../../../../scripts/infrastructure/result.mjs';
import {
  assertNoSecretLeak,
  assertOperationResult,
  SECRET_MARKERS,
} from '../../helpers/operation-result.mjs';

const STEP_OPERATIONS = Object.freeze([
  ['PostgreSQL', 'checkPostgresConnection'],
  ['MinIO', 'ensureMinioAvailable'],
  ['Storage bucket', 'ensureStorageBucket'],
  ['Prisma Client', 'generatePrismaClient'],
  ['Migrations', 'deployPrismaMigrations'],
  ['Seed data', 'seedDatabase'],
  ['Application data', 'checkRequiredApplicationData'],
  ['Final check', 'verifySetupInfrastructure'],
]);

test('runInfrastructureSetup runs every setup step sequentially and returns success', async () => {
  const calls = [];
  const completed = new Set();
  const context = createSetupContext();
  const operations = Object.fromEntries(
    STEP_OPERATIONS.map(([label, name], index) => [
      name,
      async (args) => {
        const previous = STEP_OPERATIONS[index - 1]?.[0];

        if (previous) {
          assert.equal(completed.has(previous), true);
        }

        calls.push({ args, name: label });
        assertStepArgs(label, args, context);
        await Promise.resolve();
        completed.add(label);
        return success(`${name.toUpperCase()}_OK`, `${label} completed`, {
          label,
        });
      },
    ]),
  );

  const reported = [];
  const result = await runInfrastructureSetup({
    ...context,
    onStep: (label, stepResult) => {
      reported.push({ label, result: stepResult });
    },
    operations,
  });

  assertOperationResult(result, { ok: true });
  assert.equal(result.code, 'SETUP_OK');
  assert.deepEqual(
    calls.map(({ name }) => name),
    STEP_OPERATIONS.map(([label]) => label),
  );
  assert.deepEqual(
    reported.map(({ label }) => label),
    STEP_OPERATIONS.map(([label]) => label),
  );
  assert.equal(new Set(calls.map(({ name }) => name)).size, STEP_OPERATIONS.length);
  assert.deepEqual(
    result.details.results.map(({ label, result: stepResult }) => ({
      code: stepResult.code,
      label,
      ok: stepResult.ok,
    })),
    STEP_OPERATIONS.map(([label, name]) => ({
      code: `${name.toUpperCase()}_OK`,
      label,
      ok: true,
    })),
  );
});

for (const [failedLabel, failedOperation] of STEP_OPERATIONS) {
  test(`runInfrastructureSetup stops after ${failedLabel} failure`, async () => {
    const calls = [];
    const context = createSetupContext();
    const innerFailure = failure(
      'INNER_FAILURE',
      'inner operation failed',
      {
        code: 17,
        stderr: 'diagnostic stderr',
        stdout: 'diagnostic stdout',
        timedOut: false,
      },
    );
    const operations = Object.fromEntries(
      STEP_OPERATIONS.map(([label, name]) => [
        name,
        async (args) => {
          calls.push({ args, name: label });

          if (name === failedOperation) {
            assertStepArgs(label, args, context);
            return innerFailure;
          }

          if (calls.length > STEP_OPERATIONS.findIndex(([, key]) => key === failedOperation) + 1) {
            throw new Error(`unexpected call: ${label}`);
          }

          assertStepArgs(label, args, context);
          return success(`${name.toUpperCase()}_OK`, `${label} completed`);
        },
      ]),
    );

    const result = await runInfrastructureSetup({
      ...context,
      operations,
    });

    assertOperationResult(result, { ok: false });
    assert.equal(result.code, 'SETUP_FAILED');
    assert.equal(result.details.failedStep, failedLabel);
    assert.deepEqual(
      calls.map(({ name }) => name),
      STEP_OPERATIONS.slice(
        0,
        STEP_OPERATIONS.findIndex(([label]) => label === failedLabel) + 1,
      ).map(([label]) => label),
    );
    assert.deepEqual(
      result.details.results.at(-1),
      {
        label: failedLabel,
        result: innerFailure,
      },
    );
  });
}

test('runInfrastructureSetup preserves timeout diagnostics from a failed step', async () => {
  const context = createSetupContext();
  const timeoutFailure = failure('INNER_FAILED', 'operation timed out', {
    code: null,
    stderr: '',
    stdout: 'partial output',
    timedOut: true,
  });
  const operations = createOperations({
    deployPrismaMigrations: async () => timeoutFailure,
  });

  const result = await runInfrastructureSetup({
    ...context,
    operations,
  });

  assertOperationResult(result, { ok: false });
  assert.equal(result.details.failedStep, 'Migrations');
  assert.deepEqual(result.details.results.at(-1), {
    label: 'Migrations',
    result: timeoutFailure,
  });
});

test('runInfrastructureSetup maps asynchronous operation rejection to OperationResult', async () => {
  const context = createSetupContext();
  const operations = createOperations({
    ensureMinioAvailable: async () => {
      throw new Error('operation crashed');
    },
  });

  const result = await runInfrastructureSetup({
    ...context,
    operations,
  });

  assertOperationResult(result, { ok: false });
  assert.equal(result.code, 'SETUP_FAILED');
  assert.equal(result.details.failedStep, 'MinIO');
  assert.equal(result.details.results.at(-1).result.code, 'SETUP_STEP_EXCEPTION');
  assert.equal(result.details.results.at(-1).result.details.error, 'operation crashed');
});

test('runInfrastructureSetup maps synchronous operation throw to OperationResult', async () => {
  const context = createSetupContext();
  const operations = createOperations({
    generatePrismaClient: () => {
      throw new Error('synchronous failure');
    },
  });

  const result = await runInfrastructureSetup({
    ...context,
    operations,
  });

  assertOperationResult(result, { ok: false });
  assert.equal(result.code, 'SETUP_FAILED');
  assert.equal(result.details.failedStep, 'Prisma Client');
  assert.equal(result.details.results.at(-1).result.code, 'SETUP_STEP_EXCEPTION');
  assert.equal(result.details.results.at(-1).result.details.error, 'synchronous failure');
});

test('runInfrastructureSetup reports an invalid operation result', async () => {
  const context = createSetupContext();
  const operations = createOperations({
    seedDatabase: async () => undefined,
  });

  const result = await runInfrastructureSetup({
    ...context,
    operations,
  });

  assertOperationResult(result, { ok: false });
  assert.equal(result.code, 'SETUP_FAILED');
  assert.equal(result.details.failedStep, 'Seed data');
  assert.equal(result.details.results.at(-1).result.code, 'SETUP_STEP_INVALID_RESULT');
});

test('runInfrastructureSetup rejects invalid operation result shapes', async () => {
  const context = createSetupContext();

  for (const invalidResult of [
    Object.assign([], {
      code: 'ARRAY_OK',
      message: 'array should not be a result',
      ok: true,
    }),
    {
      code: 'NULL_DETAILS_OK',
      details: null,
      message: 'null details should not be accepted',
      ok: true,
    },
    {
      code: 'ARRAY_DETAILS_OK',
      details: [],
      message: 'array details should not be accepted',
      ok: true,
    },
  ]) {
    const result = await runInfrastructureSetup({
      ...context,
      operations: createOperations({
        seedDatabase: async () => invalidResult,
      }),
    });

    assertOperationResult(result, { ok: false });
    assert.equal(result.code, 'SETUP_FAILED');
    assert.equal(result.details.failedStep, 'Seed data');
    assert.equal(result.details.results.at(-1).result.code, 'SETUP_STEP_INVALID_RESULT');
  }
});

test('runInfrastructureSetup protects step results from onStep mutation', async () => {
  const calls = [];
  const context = createSetupContext();
  const operations = createOperations({
    checkPostgresConnection: async () =>
      failure('POSTGRES_FAILED', 'PostgreSQL failed', {
        original: true,
      }),
    ensureMinioAvailable: async () => {
      calls.push('MinIO');
      return success('MINIO_OK', 'MinIO completed');
    },
  });

  const result = await runInfrastructureSetup({
    ...context,
    onStep: (_label, stepResult) => {
      stepResult.ok = true;
      stepResult.code = 'MUTATED';
      stepResult.details.mutated = true;
    },
    operations,
  });

  assertOperationResult(result, { ok: false });
  assert.equal(result.code, 'SETUP_FAILED');
  assert.equal(result.details.failedStep, 'PostgreSQL');
  assert.deepEqual(calls, []);
  assert.deepEqual(result.details.results, [
    {
      label: 'PostgreSQL',
      result: {
        code: 'POSTGRES_FAILED',
        details: {
          original: true,
        },
        message: 'PostgreSQL failed',
        ok: false,
      },
    },
  ]);
});

test('runInfrastructureSetup maps onStep exceptions to OperationResult', async () => {
  const context = createSetupContext();
  const result = await runInfrastructureSetup({
    ...context,
    onStep: () => {
      throw new Error(`callback failed DATABASE_PASSWORD=hunter2 ${SECRET_MARKERS[0]}`);
    },
    operations: createOperations(),
  });

  assertOperationResult(result, { ok: false });
  assert.equal(result.code, 'SETUP_STEP_CALLBACK_FAILED');
  assert.equal(result.details.failedStep, 'PostgreSQL');
  assert.equal(
    result.details.error,
    'callback failed [redacted]=[redacted] [redacted]',
  );
  assert.equal(result.details.results.length, 1);
  assertNoSecretLeak(result);
});

test('runInfrastructureSetup returns cleanup failure with setup diagnostics', async () => {
  const context = createSetupContext({
    resources: {
      cleanup: async () => ({
        cleanupErrors: 1,
        ok: false,
        results: [
          {
            name: 'MinIO',
            result: {
              message: 'cleanup failed',
              ok: false,
            },
          },
        ],
      }),
    },
  });
  const result = await runInfrastructureSetup({
    ...context,
    operations: createOperations({
      ensureStorageBucket: async () =>
        failure('MINIO_BUCKET_FAILED', 'bucket failed'),
    }),
  });

  assertOperationResult(result, { ok: false });
  assert.equal(result.code, 'SETUP_CLEANUP_FAILED');
  assert.equal(result.details.setupResult.code, 'SETUP_FAILED');
  assert.equal(result.details.setupResult.details.failedStep, 'Storage bucket');
  assert.equal(result.details.cleanup.cleanupErrors, 1);
});

test('runInfrastructureSetup maps cleanup rejection to cleanup failure result', async () => {
  const context = createSetupContext({
    resources: {
      cleanup: async () => {
        throw new Error(`cleanup crashed ${SECRET_MARKERS[0]}`);
      },
    },
  });

  const result = await runInfrastructureSetup({
    ...context,
    operations: createOperations(),
  });

  assertOperationResult(result, { ok: false });
  assert.equal(result.code, 'SETUP_CLEANUP_FAILED');
  assert.equal(result.details.cleanup.ok, false);
  assert.equal(result.details.cleanup.error, 'cleanup crashed [redacted]');
  assert.equal(result.details.setupResult.code, 'SETUP_OK');
  assertNoSecretLeak(result);
});

test('runInfrastructureSetup maps invalid cleanup result to cleanup failure result', async () => {
  const context = createSetupContext({
    resources: {
      cleanup: async () => null,
    },
  });

  const result = await runInfrastructureSetup({
    ...context,
    operations: createOperations(),
  });

  assertOperationResult(result, { ok: false });
  assert.equal(result.code, 'SETUP_CLEANUP_FAILED');
  assert.deepEqual(result.details.cleanup, {
    error: 'Cleanup returned an invalid result',
    ok: false,
  });
  assert.equal(result.details.setupResult.code, 'SETUP_OK');
});

test('runInfrastructureSetup does not start new steps after shutdown', async () => {
  const calls = [];
  const context = createSetupContext();
  const result = await runInfrastructureSetup({
    ...context,
    isShuttingDown: () => calls.length > 0,
    operations: createOperations({
      checkPostgresConnection: async () => {
        calls.push('PostgreSQL');
        return success('POSTGRES_OK', 'PostgreSQL completed');
      },
      ensureMinioAvailable: async () => {
        calls.push('MinIO');
        return success('MINIO_OK', 'MinIO completed');
      },
    }),
  });

  assertOperationResult(result, { ok: false });
  assert.equal(result.code, 'SETUP_ABORTED');
  assert.deepEqual(calls, ['PostgreSQL']);
});

test('runInfrastructureSetup maps shutdown check exceptions to a result', async () => {
  const calls = [];
  const context = createSetupContext();
  const result = await runInfrastructureSetup({
    ...context,
    isShuttingDown: () => {
      throw new Error(`shutdown check failed ${SECRET_MARKERS[0]}`);
    },
    operations: createOperations({
      checkPostgresConnection: async () => {
        calls.push('PostgreSQL');
        return success('POSTGRES_OK', 'PostgreSQL completed');
      },
    }),
  });

  assertOperationResult(result, { ok: false });
  assert.equal(result.code, 'SETUP_SHUTDOWN_CHECK_FAILED');
  assert.deepEqual(calls, []);
  assert.equal(result.details.error, 'shutdown check failed [redacted]');
  assertNoSecretLeak(result);
});

test('runInfrastructureSetup passes MinIO readiness override into MinIO startup', async () => {
  const context = createSetupContext();
  const fakeReadiness = async () =>
    success('MINIO_READINESS_OK', 'MinIO readiness checked');
  let receivedReadiness = null;

  const result = await runInfrastructureSetup({
    ...context,
    operations: createOperations({
      checkMinioReadiness: fakeReadiness,
      ensureMinioAvailable: async ({ checkReadiness }) => {
        receivedReadiness = checkReadiness;
        return success('MINIO_OK', 'MinIO completed');
      },
    }),
  });

  assertOperationResult(result, { ok: true });
  assert.equal(receivedReadiness, fakeReadiness);
});

test('default final check uses injected PostgreSQL dependency', async () => {
  const operations = createDefaultSetupOperations();
  const result = await operations.verifySetupInfrastructure({
    checkPostgresConnection: async () =>
      failure('POSTGRES_FAKE_FAILED', 'fake postgres failed'),
    config: createSetupContext().config,
  });

  assertOperationResult(result, { ok: false });
  assert.equal(result.code, 'SETUP_FINAL_CHECK_FAILED');
  assert.equal(result.details.causeCode, 'POSTGRES_FAKE_FAILED');
});

test('default final check uses injected MinIO readiness dependency', async () => {
  const operations = createDefaultSetupOperations();
  const result = await operations.verifySetupInfrastructure({
    checkMinioReadiness: async () =>
      failure('MINIO_FAKE_FAILED', 'fake minio failed'),
    checkPostgresConnection: async () =>
      success('POSTGRES_FAKE_OK', 'fake postgres ok'),
    config: createSetupContext().config,
  });

  assertOperationResult(result, { ok: false });
  assert.equal(result.code, 'SETUP_FINAL_CHECK_FAILED');
  assert.equal(result.details.causeCode, 'MINIO_FAKE_FAILED');
});

test('default storage bucket operation reports client cleanup failure', async () => {
  const operations = createDefaultSetupOperations();
  const context = createSetupContext();
  const result = await operations.ensureStorageBucket({
    config: context.config,
    CreateBucketCommand: context.commands.CreateBucketCommand,
    HeadBucketCommand: context.commands.HeadBucketCommand,
    S3Client: createS3ClientClass({
      destroyError: new Error('destroy failed'),
    }),
  });

  assertOperationResult(result, { ok: false });
  assert.equal(result.code, 'MINIO_CLIENT_CLEANUP_FAILED');
  assert.equal(result.details.cleanupError, 'destroy failed');
  assert.equal(result.details.operationResult.code, 'MINIO_BUCKET_AVAILABLE');
});

test('default storage bucket preserves main failure when client cleanup fails', async () => {
  const operations = createDefaultSetupOperations();
  const context = createSetupContext();
  const result = await operations.ensureStorageBucket({
    config: context.config,
    CreateBucketCommand: context.commands.CreateBucketCommand,
    HeadBucketCommand: context.commands.HeadBucketCommand,
    S3Client: createS3ClientClass({
      destroyError: new Error('destroy failed'),
      headBucketError: Object.assign(new Error('access denied'), {
        name: 'AccessDenied',
      }),
    }),
  });

  assertOperationResult(result, { ok: false });
  assert.equal(result.code, 'MINIO_ACCESS_DENIED');
  assert.equal(result.details.cleanupError, 'destroy failed');
});

test('default final check reports client cleanup failure after success', async () => {
  const operations = createDefaultSetupOperations();
  const context = createSetupContext();
  const result = await operations.verifySetupInfrastructure({
    checkMinioReadiness: async () =>
      success('MINIO_READINESS_OK', 'MinIO ready'),
    checkPostgresConnection: async () =>
      success('POSTGRES_OK', 'PostgreSQL ready'),
    config: context.config,
    DeleteObjectCommand: context.commands.DeleteObjectCommand,
    GetObjectCommand: context.commands.GetObjectCommand,
    HeadBucketCommand: context.commands.HeadBucketCommand,
    PgClient: context.PgClient,
    PutObjectCommand: context.commands.PutObjectCommand,
    S3Client: createS3ClientClass({
      destroyError: new Error('destroy failed'),
    }),
  });

  assertOperationResult(result, { ok: false });
  assert.equal(result.code, 'MINIO_CLIENT_CLEANUP_FAILED');
  assert.equal(result.details.cleanupError, 'destroy failed');
  assert.equal(result.details.operationResult.code, 'SETUP_FINAL_CHECK_OK');
});

test('default final check preserves main failure when client cleanup fails', async () => {
  const operations = createDefaultSetupOperations();
  const context = createSetupContext();
  const result = await operations.verifySetupInfrastructure({
    checkMinioReadiness: async () =>
      success('MINIO_READINESS_OK', 'MinIO ready'),
    checkPostgresConnection: async () =>
      success('POSTGRES_OK', 'PostgreSQL ready'),
    config: context.config,
    DeleteObjectCommand: context.commands.DeleteObjectCommand,
    GetObjectCommand: context.commands.GetObjectCommand,
    HeadBucketCommand: context.commands.HeadBucketCommand,
    PgClient: context.PgClient,
    PutObjectCommand: context.commands.PutObjectCommand,
    S3Client: createS3ClientClass({
      destroyError: new Error('destroy failed'),
      headBucketError: Object.assign(new Error('missing bucket'), {
        name: 'NoSuchBucket',
      }),
    }),
  });

  assertOperationResult(result, { ok: false });
  assert.equal(result.code, 'SETUP_FINAL_CHECK_FAILED');
  assert.equal(result.details.causeCode, 'MINIO_BUCKET_MISSING');
  assert.equal(result.details.cleanupError, 'destroy failed');
});

test('runInfrastructureSetup preserves step failure priority over onStep errors', async () => {
  const context = createSetupContext();
  const stepFailure = failure('POSTGRES_FAILED', 'PostgreSQL failed', {
    original: true,
  });
  const result = await runInfrastructureSetup({
    ...context,
    onStep: () => {
      throw new Error(`callback failed DATABASE_PASSWORD=hunter2 ${SECRET_MARKERS[0]}`);
    },
    operations: createOperations({
      checkPostgresConnection: async () => stepFailure,
    }),
  });

  assertOperationResult(result, { ok: false });
  assert.equal(result.code, 'SETUP_FAILED');
  assert.equal(result.message, 'PostgreSQL failed');
  assert.equal(result.details.failedStep, 'PostgreSQL');
  assert.equal(
    result.details.stepCallbackError,
    'callback failed [redacted]=[redacted] [redacted]',
  );
  assert.deepEqual(result.details.results, [
    {
      label: 'PostgreSQL',
      result: stepFailure,
    },
  ]);
  assertNoSecretLeak(result);
});

test('runInfrastructureSetup maps async onStep rejections to OperationResult', async () => {
  const context = createSetupContext();
  const result = await runInfrastructureSetup({
    ...context,
    onStep: async () => {
      throw new Error('async callback failed');
    },
    operations: createOperations(),
  });

  assertOperationResult(result, { ok: false });
  assert.equal(result.code, 'SETUP_STEP_CALLBACK_FAILED');
  assert.equal(result.details.failedStep, 'PostgreSQL');
  assert.equal(result.details.error, 'async callback failed');
});

test('runInfrastructureSetup does not leak secrets from operation results', async () => {
  const context = createSetupContext();
  const operations = createOperations({
    checkPostgresConnection: async () =>
      failure(`FAILED_${SECRET_MARKERS[0]}`, `failed ${SECRET_MARKERS[1]}`, {
        stderr: `stderr ${SECRET_MARKERS[0]}`,
        stdout: `stdout ${SECRET_MARKERS[1]}`,
        token: SECRET_MARKERS[2],
      }),
  });

  const result = await runInfrastructureSetup({
    ...context,
    operations,
  });

  assertOperationResult(result, { ok: false });
  assertNoSecretLeak(result);
});

test('runInfrastructureSetup does not leak secrets from operation result keys', async () => {
  const context = createSetupContext();
  const operations = createOperations({
    checkPostgresConnection: async () =>
      failure('POSTGRES_FAILED', 'PostgreSQL failed', {
        [SECRET_MARKERS[0]]: true,
        nested: {
          [SECRET_MARKERS[1]]: 'secret key name',
        },
      }),
  });

  const result = await runInfrastructureSetup({
    ...context,
    operations,
  });

  assertOperationResult(result, { ok: false });
  assertNoSecretLeak(result);
});

test('runInfrastructureSetup sanitizes cyclic operation details safely', async () => {
  const context = createSetupContext();
  const details = {
    label: 'cyclic details',
  };
  details.self = details;

  const result = await runInfrastructureSetup({
    ...context,
    operations: createOperations({
      verifySetupInfrastructure: async () =>
        success('FINAL_OK', 'Final check completed', details),
    }),
  });

  assertOperationResult(result, { ok: true });
  assert.deepEqual(result.details.results.at(-1), {
    label: 'Final check',
    result: {
      code: 'FINAL_OK',
      details: {
        label: 'cyclic details',
        self: '[Circular]',
      },
      message: 'Final check completed',
      ok: true,
    },
  });
});

test('runInfrastructureSetup does not leak secrets from operation exceptions', async () => {
  const context = createSetupContext();
  const operations = createOperations({
    checkRequiredApplicationData: async () => {
      throw new Error(`operation crashed ${SECRET_MARKERS[0]}`);
    },
  });

  const result = await runInfrastructureSetup({
    ...context,
    operations,
  });

  assertOperationResult(result, { ok: false });
  assertNoSecretLeak(result);
});

function createOperations(overrides = {}) {
  const stepOperationNames = new Set(STEP_OPERATIONS.map(([, name]) => name));
  const stepOperations = Object.fromEntries(
    STEP_OPERATIONS.map(([label, name]) => [
      name,
      overrides[name] ??
        (async () => success(`${name.toUpperCase()}_OK`, `${label} completed`)),
    ]),
  );

  return {
    ...stepOperations,
    ...Object.fromEntries(
      Object.entries(overrides).filter(([name]) => !stepOperationNames.has(name)),
    ),
  };
}

function createSetupContext(overrides = {}) {
  class PgClient {}
  class S3Client {}
  class CreateBucketCommand {
    constructor(input = {}) {
      this.commandName = 'CreateBucketCommand';
      Object.assign(this, input);
    }
  }
  class DeleteObjectCommand {
    constructor(input = {}) {
      this.commandName = 'DeleteObjectCommand';
      Object.assign(this, input);
    }
  }
  class GetObjectCommand {
    constructor(input = {}) {
      this.commandName = 'GetObjectCommand';
      Object.assign(this, input);
    }
  }
  class HeadBucketCommand {
    constructor(input = {}) {
      this.commandName = 'HeadBucketCommand';
      Object.assign(this, input);
    }
  }
  class PutObjectCommand {
    constructor(input = {}) {
      this.commandName = 'PutObjectCommand';
      Object.assign(this, input);
    }
  }

  return {
    commands: {
      CreateBucketCommand,
      DeleteObjectCommand,
      GetObjectCommand,
      HeadBucketCommand,
      PutObjectCommand,
    },
    config: {
      minio: {
        bucket: 'esoft',
      },
    },
    npm: 'custom-npm-executable',
    PgClient,
    projectRoot: 'C:/project',
    resources: {
      cleanup: async () => ({
        cleanupErrors: 0,
        ok: true,
        results: [],
      }),
      registerProcess: () => {
        throw new Error('unexpected process registration');
      },
    },
    runCommand: async () => {
      throw new Error('unexpected real command execution');
    },
    S3Client,
    ...overrides,
  };
}

function createS3ClientClass({
  destroyError = null,
  headBucketError = null,
} = {}) {
  return class FakeS3Client {
    #objectBody = null;

    destroy() {
      if (destroyError) {
        throw destroyError;
      }
    }

    async send(command) {
      if ('Body' in command) {
        this.#objectBody = command.Body;
        return {};
      }

      if (command.commandName === 'HeadBucketCommand') {
        if (headBucketError) {
          throw headBucketError;
        }

        return {};
      }

      if (command.commandName === 'GetObjectCommand') {
        return {
          Body: {
            transformToString: async () => this.#objectBody,
          },
        };
      }

      return {};
    }
  };
}

function assertStepArgs(label, args, context) {
  switch (label) {
    case 'PostgreSQL':
    case 'Application data':
      assert.deepEqual(args, {
        config: context.config,
        PgClient: context.PgClient,
      });
      return;
    case 'MinIO':
      assert.equal(typeof args.checkReadiness, 'function');
      assert.deepEqual(
        {
          config: args.config,
          resources: args.resources,
        },
        {
        config: context.config,
        resources: context.resources,
        },
      );
      return;
    case 'Storage bucket':
      assert.deepEqual(args, {
        config: context.config,
        CreateBucketCommand: context.commands.CreateBucketCommand,
        HeadBucketCommand: context.commands.HeadBucketCommand,
        S3Client: context.S3Client,
      });
      return;
    case 'Prisma Client':
    case 'Migrations':
    case 'Seed data':
      assert.deepEqual(args, {
        npm: context.npm,
        projectRoot: context.projectRoot,
        runCommand: context.runCommand,
      });
      return;
    case 'Final check':
      assert.equal(typeof args.checkMinioReadiness, 'function');
      assert.equal(typeof args.checkPostgresConnection, 'function');
      assert.deepEqual(
        {
          config: args.config,
          DeleteObjectCommand: args.DeleteObjectCommand,
          GetObjectCommand: args.GetObjectCommand,
          HeadBucketCommand: args.HeadBucketCommand,
          PgClient: args.PgClient,
          PutObjectCommand: args.PutObjectCommand,
          S3Client: args.S3Client,
        },
        {
        config: context.config,
        DeleteObjectCommand: context.commands.DeleteObjectCommand,
        GetObjectCommand: context.commands.GetObjectCommand,
        HeadBucketCommand: context.commands.HeadBucketCommand,
        PgClient: context.PgClient,
        PutObjectCommand: context.commands.PutObjectCommand,
        S3Client: context.S3Client,
        },
      );
      return;
    default:
      throw new Error(`Unknown setup step: ${label}`);
  }
}
