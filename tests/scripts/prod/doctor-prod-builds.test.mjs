import assert from 'node:assert/strict';
import test from 'node:test';

import { runProductionDoctor } from '../../../scripts/prod/doctor-prod.mjs';
import { assertOperationResult } from '../helpers/operation-result.mjs';
import { createTemporaryProject } from '../helpers/temporary-project.mjs';
import {
  createLoadedConfig,
  createOperations,
  createTestRuntime,
} from './helpers/doctor-prod-helpers.mjs';

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
