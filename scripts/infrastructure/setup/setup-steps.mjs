export const SETUP_STEPS = Object.freeze([
  Object.freeze({
    label: 'PostgreSQL',
    run: ({ config, operations, PgClient }) =>
      operations.checkPostgresConnection({ config, PgClient }),
  }),
  Object.freeze({
    label: 'MinIO',
    run: ({ config, operations, resources }) =>
      operations.ensureMinioAvailable({
        checkReadiness: operations.checkMinioReadiness,
        config,
        resources,
      }),
  }),
  Object.freeze({
    label: 'Storage bucket',
    run: ({ config, commands, operations, S3Client }) =>
      operations.ensureStorageBucket({
        config,
        CreateBucketCommand: commands.CreateBucketCommand,
        HeadBucketCommand: commands.HeadBucketCommand,
        S3Client,
      }),
  }),
  Object.freeze({
    label: 'Prisma Client',
    run: ({ npm, operations, projectRoot, runCommand }) =>
      operations.generatePrismaClient({ npm, projectRoot, runCommand }),
  }),
  Object.freeze({
    label: 'Migrations',
    run: ({ npm, operations, projectRoot, runCommand }) =>
      operations.deployPrismaMigrations({ npm, projectRoot, runCommand }),
  }),
  Object.freeze({
    label: 'Seed data',
    run: ({ npm, operations, projectRoot, runCommand }) =>
      operations.seedDatabase({ npm, projectRoot, runCommand }),
  }),
  Object.freeze({
    label: 'Application data',
    run: ({ config, operations, PgClient }) =>
      operations.checkRequiredApplicationData({ config, PgClient }),
  }),
  Object.freeze({
    label: 'Final check',
    run: ({ config, commands, operations, PgClient, S3Client }) =>
      operations.verifySetupInfrastructure({
        config,
        DeleteObjectCommand: commands.DeleteObjectCommand,
        GetObjectCommand: commands.GetObjectCommand,
        HeadBucketCommand: commands.HeadBucketCommand,
        PgClient,
        PutObjectCommand: commands.PutObjectCommand,
        S3Client,
        checkMinioReadiness: operations.checkMinioReadiness,
        checkPostgresConnection: operations.checkPostgresConnection,
      }),
  }),
]);
