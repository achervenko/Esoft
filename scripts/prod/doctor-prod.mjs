import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { failure, success } from '../infrastructure/result.mjs';
import {
  formatError,
  redactSecrets,
} from '../infrastructure/security/redaction.mjs';
import {
  createDefaultProductionDoctorContext,
  createDefaultProductionDoctorOperations,
  loadRuntimeDependencies,
} from './doctor-prod.operations.mjs';
import { createProductionDoctorReporter } from './doctor-prod.reporter.mjs';

const CHECK_COUNT = 6;

export async function runProductionDoctor(options = {}) {
  const output = options.output ?? console;
  const reporter = options.reporter ?? createProductionDoctorReporter({ output });
  const operations = {
    ...createDefaultProductionDoctorOperations(),
    ...(options.operations ?? {}),
  };
  const context = createDefaultProductionDoctorContext(options);
  const checks = [];

  const configCheck = await runCheck({
    checks,
    index: 1,
    label: 'Production configuration',
    reporter,
    run: () =>
      operations.loadProductionConfig({
        projectRoot: context.projectRoot,
      }),
    selectResult: (configuration) => configuration.result,
  });

  const configAvailable = configCheck.result.ok;
  const config = configCheck.value?.config;
  const env = configCheck.value?.env;
  const projectRoot = configCheck.value?.projectRoot ?? context.projectRoot;
  const commandContext = {
    env,
    npm: context.npm,
    projectRoot,
    runCommand: context.runCommand,
  };

  await runConfigDependentCheck({
    checks,
    configAvailable,
    index: 2,
    label: 'PostgreSQL',
    reporter,
    run: () =>
      operations.checkPostgresConnection({
        config,
        PgClient: context.PgClient,
      }),
  });

  await runConfigDependentCheck({
    checks,
    configAvailable,
    index: 3,
    label: 'Prisma migrations',
    reporter,
    run: () => operations.checkPrismaMigrationStatus(commandContext),
  });

  await runConfigDependentCheck({
    checks,
    configAvailable,
    index: 4,
    label: 'MinIO bucket',
    reporter,
    run: () =>
      operations.checkStorageBucket({
        config,
        HeadBucketCommand: context.HeadBucketCommand,
        S3Client: context.S3Client,
      }),
  });

  await runCheck({
    checks,
    index: 5,
    label: 'Backend build',
    reporter,
    run: () => operations.checkBackendBuild({ projectRoot }),
  });

  await runCheck({
    checks,
    index: 6,
    label: 'Frontend build',
    reporter,
    run: () => operations.checkFrontendBuild({ projectRoot }),
  });

  const finalResult = createFinalResult(checks);
  reporter.summary(finalResult);

  return finalResult;
}

async function runConfigDependentCheck({
  checks,
  configAvailable,
  index,
  label,
  reporter,
  run,
}) {
  if (!configAvailable) {
    return runCheck({
      checks,
      index,
      label,
      reporter,
      run: () =>
        success(
          'PROD_DOCTOR_CHECK_SKIPPED',
          'Skipped because production configuration is unavailable',
        ),
    });
  }

  return runCheck({
    checks,
    index,
    label,
    reporter,
    run,
  });
}

async function runCheck({
  checks,
  index,
  label,
  reporter,
  run,
  selectResult = defaultSelectResult,
}) {
  let value;
  let result;

  try {
    value = await run();
    result = selectResult(value);
  } catch (error) {
    result = failure('PROD_DOCTOR_CHECK_FAILED', `${label} check failed`, {
      error: formatError(error),
    });
  }

  const safeResult = redactSecrets(result);
  const check = {
    label,
    result: safeResult,
  };
  checks.push(check);
  reporter.check(index, CHECK_COUNT, check);

  return {
    result: safeResult,
    value,
  };
}

function createFinalResult(checks) {
  const ok = checks.every((check) => check.result.ok);

  return (ok ? success : failure)(
    ok ? 'PROD_DOCTOR_OK' : 'PROD_DOCTOR_FAILED',
    ok
      ? 'Production environment is ready'
      : 'Production environment is not ready',
    {
      checks,
    },
  );
}

function defaultSelectResult(value) {
  return value;
}

const isMainModule =
  process.argv[1] &&
  fileURLToPath(import.meta.url) === resolve(process.argv[1]);

if (isMainModule) {
  const result = await runProductionDoctor({
    runtimeDependencies: loadRuntimeDependencies(),
  });

  process.exitCode = result.ok ? 0 : 1;
}
