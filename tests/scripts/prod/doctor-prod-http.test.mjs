import assert from 'node:assert/strict';
import test from 'node:test';
import { runProductionDoctor } from '../../../scripts/prod/doctor-prod.mjs';
import { checkBackendRuntimeHealth } from '../../../scripts/prod/doctor-prod.operations.mjs';
import {
  createConfig,
  createLoadedConfig,
  createOperations,
  createTestRuntime,
} from './helpers/doctor-prod-helpers.mjs';

const healthyBody = {
  status: 'ok',
  dependencies: { postgres: 'ok', minio: 'ok', minioBucket: 'ok' },
};

async function runHttpChecks(fetchImpl, config = createConfig()) {
  return runProductionDoctor({
    ...createTestRuntime(),
    fetchImpl,
    operations: createOperations({
      loadProductionConfig: () => ({ ...createLoadedConfig(), config }),
      checkBackendRuntimeHealth: undefined,
      checkFrontendHttp: undefined,
    }),
  });
}

test('production doctor uses public HTTPS addresses even when internal listeners differ', async () => {
  const config = createConfig();
  config.backend = {
    url: 'https://insolution-esoft.ru',
    internalUrl: 'http://127.0.0.1:3000',
  };
  config.frontend = {
    url: 'https://insolution-esoft.ru',
    internalUrl: 'http://127.0.0.1:5173',
  };
  const urls = [];
  const result = await runHttpChecks(async (url) => {
    urls.push(url);
    return url.endsWith('/api/health')
      ? Response.json(healthyBody)
      : new Response('<html></html>', { headers: { 'content-type': 'text/html' } });
  }, config);
  assert.equal(result.ok, true);
  assert.deepEqual(urls, ['https://insolution-esoft.ru/api/health', 'https://insolution-esoft.ru']);
});

test('doctor checks the configured backend health and frontend addresses', async () => {
  const urls = [];
  const result = await runHttpChecks(async (url, { signal }) => {
    assert.ok(signal instanceof AbortSignal);
    urls.push(url);
    return url.endsWith('/api/health')
      ? Response.json(healthyBody)
      : new Response('<html></html>', { headers: { 'content-type': 'text/html' } });
  });
  assert.equal(result.ok, true);
  assert.equal(result.details.checks.length, 8);
  assert.deepEqual(urls, ['http://127.0.0.1:3000/api/health', 'http://127.0.0.1:5173']);
});

for (const endpoint of ['backend', 'frontend']) {
  test(`builds and dependencies do not imply readiness when ${endpoint} is unreachable`, async () => {
    const result = await runHttpChecks(async (url) => {
      const isBackend = url.endsWith('/api/health');
      if (isBackend === (endpoint === 'backend')) throw new Error('Connection refused');
      return isBackend
        ? Response.json(healthyBody)
        : new Response('<html></html>', { headers: { 'content-type': 'text/html' } });
    });
    assert.equal(result.ok, false);
    assert.equal(result.details.checks.filter(({ result }) => !result.ok).length, 1);
  });
}

for (const body of [null, { status: 'ok' }, {
  ...healthyBody,
  dependencies: { ...healthyBody.dependencies, postgres: 'error' },
}]) {
  test(`HTTP 200 with an invalid health body is rejected: ${JSON.stringify(body)}`, async () => {
    const result = await checkBackendRuntimeHealth({
      config: createConfig(),
      fetchImpl: async () => Response.json(body),
    });
    assert.equal(result.ok, false);
    assert.equal(result.code, 'PROD_BACKEND_HEALTH_INVALID');
  });
}

test('HTTP 503 and request timeout are reported as health failures', async () => {
  const unavailable = await checkBackendRuntimeHealth({
    config: createConfig(),
    fetchImpl: async () => Response.json({ status: 'error' }, { status: 503 }),
  });
  assert.equal(unavailable.code, 'BACKEND_HEALTH_UNAVAILABLE');
  const timedOut = await checkBackendRuntimeHealth({
    config: createConfig(),
    requestTimeoutMs: 5,
    fetchImpl: (_url, { signal }) => new Promise((_resolve, reject) => {
      const keepAlive = setTimeout(() => reject(new Error('Abort was not received')), 1_000);
      signal.addEventListener('abort', () => {
        clearTimeout(keepAlive);
        reject(signal.reason);
      }, { once: true });
    }),
  });
  assert.equal(timedOut.code, 'BACKEND_HEALTH_UNREACHABLE');
});
