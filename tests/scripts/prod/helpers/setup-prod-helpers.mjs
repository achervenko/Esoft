import { success } from '../../../../scripts/infrastructure/result.mjs';

export function createOperations(overrides = {}) {
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

export function createS3ClientClass({
  destroyError = null,
  headBucketError = null,
} = {}) {
  return class FakeS3Client {
    destroy() {
      if (destroyError) {
        throw destroyError;
      }
    }

    async send(command) {
      if (command.constructor.name === 'HeadBucketCommand' && headBucketError) {
        throw headBucketError;
      }

      return {};
    }
  };
}

export function createTestRuntime({ output = createOutput() } = {}) {
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

export function createOutput() {
  const lines = [];

  return {
    lines,
    log(value = '') {
      lines.push(String(value));
    },
  };
}

export function createConfig() {
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
