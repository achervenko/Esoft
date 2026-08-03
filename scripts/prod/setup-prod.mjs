import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { success } from '../infrastructure/result.mjs';
import {
  createDefaultProductionSetupContext,
  createDefaultProductionSetupOperations,
  loadRuntimeDependencies,
  normalizePreDeployMigrationStatus,
} from './setup-prod.operations.mjs';
import {
  createProductionSetupReporter,
  createProductionSetupStageRunner,
  finishProductionSetupFailure,
} from './setup-prod.reporter.mjs';

const STAGE_COUNT = 8;

export { normalizePreDeployMigrationStatus };

export async function runProductionSetup(options = {}) {
  const output = options.output ?? console;
  const reporter = options.reporter ?? createProductionSetupReporter({ output });
  const operations = {
    ...createDefaultProductionSetupOperations(),
    ...(options.operations ?? {}),
  };
  const context = createDefaultProductionSetupContext(options);
  const results = [];
  const stage = createProductionSetupStageRunner({
    onStage: options.onStage,
    reporter,
    results,
    totalStages: STAGE_COUNT,
  });

  const configStage = await stage(
    1,
    'Validating production configuration',
    () =>
      operations.loadProductionConfig({
        projectRoot: context.projectRoot,
      }),
    (configuration) => configuration.result,
  );

  if (!configStage.result.ok) {
    return finishProductionSetupFailure(configStage.result, results, reporter);
  }

  const { config, projectRoot } = configStage.value;
  const commandContext = {
    npm: context.npm,
    projectRoot,
    runCommand: context.runCommand,
  };

  const postgresStage = await stage(2, 'Checking PostgreSQL', () =>
    operations.checkPostgresConnection({
      config,
      PgClient: context.PgClient,
    }),
  );

  if (!postgresStage.result.ok) {
    return finishProductionSetupFailure(postgresStage.result, results, reporter);
  }

  const generateStage = await stage(3, 'Generating Prisma Client', () =>
    operations.generatePrismaClient(commandContext),
  );

  if (!generateStage.result.ok) {
    return finishProductionSetupFailure(generateStage.result, results, reporter);
  }

  const statusBeforeStage = await stage(
    4,
    'Checking migration status',
    async () =>
      normalizePreDeployMigrationStatus(
        await operations.checkPrismaMigrationStatus(commandContext),
      ),
  );

  if (!statusBeforeStage.result.ok) {
    return finishProductionSetupFailure(
      statusBeforeStage.result,
      results,
      reporter,
    );
  }

  const deployStage = await stage(5, 'Applying migrations', () =>
    operations.deployPrismaMigrations(commandContext),
  );

  if (!deployStage.result.ok) {
    return finishProductionSetupFailure(deployStage.result, results, reporter);
  }

  const statusAfterStage = await stage(6, 'Verifying migration status', () =>
    operations.checkPrismaMigrationStatus(commandContext),
  );

  if (!statusAfterStage.result.ok) {
    return finishProductionSetupFailure(
      statusAfterStage.result,
      results,
      reporter,
    );
  }

  const seedStage = await stage(7, 'Initializing production data', () =>
    operations.seedDatabase(commandContext),
  );

  if (!seedStage.result.ok) {
    return finishProductionSetupFailure(seedStage.result, results, reporter);
  }

  const minioStage = await stage(8, 'Checking object storage', () =>
    operations.ensureStorageBucket({
      config,
      CreateBucketCommand: context.CreateBucketCommand,
      HeadBucketCommand: context.HeadBucketCommand,
      S3Client: context.S3Client,
    }),
  );

  if (!minioStage.result.ok) {
    return finishProductionSetupFailure(minioStage.result, results, reporter);
  }

  const finalResult = success('PROD_SETUP_OK', 'Production setup completed', {
    results,
  });
  reporter.success();

  return finalResult;
}

const isMainModule =
  process.argv[1] &&
  fileURLToPath(import.meta.url) === resolve(process.argv[1]);

if (isMainModule) {
  const result = await runProductionSetup({
    runtimeDependencies: loadRuntimeDependencies(),
  });

  process.exitCode = result.ok ? 0 : 1;
}
