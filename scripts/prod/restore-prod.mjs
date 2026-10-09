import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { withProductionOperationLock } from './production-operation-lock.mjs';

import { executeProductionRestore } from './restore-prod.execute.mjs';
import {
  createDefaultProductionRestoreContext,
  createDefaultProductionRestoreOperations,
  loadRuntimeDependencies,
} from './restore-prod.operations.mjs';
import {
  createProductionRestoreReporter,
  createProductionRestoreStageRunner,
  finishProductionRestoreFailure,
} from './restore-prod.reporter.mjs';

const STAGE_COUNT = 13;

export async function runProductionRestore(options = {}) {
  const output = options.output ?? console;
  const reporter =
    options.reporter ?? createProductionRestoreReporter({ output });
  const operations = {
    ...createDefaultProductionRestoreOperations(),
    ...(options.operations ?? {}),
  };
  const context = createDefaultProductionRestoreContext(options);
  const results = [];
  const restoreState = {};
  const stage = createProductionRestoreStageRunner({
    onStage: options.onStage,
    reporter,
    results,
    totalStages: STAGE_COUNT,
  });

  const argumentsStage = await stage(1, 'Parsing restore arguments', () =>
    operations.parseRestoreArguments(context.argv),
  );

  if (!argumentsStage.result.ok) {
    return fail({
      failedStage: 'Parsing restore arguments',
      reporter,
      restoreState,
      result: argumentsStage.result,
      results,
    });
  }

  restoreState.backupPath = argumentsStage.result.details.backupPath;
  reporter.notice?.();

  const configStage = await stage(
    2,
    'Validating production configuration',
    () =>
      operations.loadProductionConfig({
        projectRoot: context.projectRoot,
      }),
    (configuration) => configuration.result,
  );

  if (!configStage.result.ok) {
    return fail({
      failedStage: 'Validating production configuration',
      reporter,
      restoreState,
      result: configStage.result,
      results,
    });
  }

  const { config } = configStage.value;
  const projectRoot = configStage.value.projectRoot ?? context.projectRoot;

  return withProductionOperationLock({
    projectRoot,
    operation: 'restore',
    onFailure: (result) =>
      fail({
        restoreState,
        failedStage: 'Production operation lock',
        reporter,
        result,
        results,
      }),
    run: () =>
      executeProductionRestore({
        config,
        projectRoot,
        restoreState,
        operations,
        context,
        stage,
        reporter,
        results,
      }),
  });
}

function fail({ failedStage, reporter, restoreState, result, results }) {
  return finishProductionRestoreFailure({
    failedStage,
    reporter,
    restoreState,
    result,
    results,
  });
}

const isMainModule =
  process.argv[1] &&
  fileURLToPath(import.meta.url) === resolve(process.argv[1]);

if (isMainModule) {
  const result = await runProductionRestore({
    runtimeDependencies: loadRuntimeDependencies(),
  });

  process.exitCode = result.ok ? 0 : 1;
}
