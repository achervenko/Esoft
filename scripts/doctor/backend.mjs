import {
  checkBackendHealth,
  waitForBackendHealth as waitForBackendHealthOperation,
} from '../infrastructure/http/backend-health.mjs';

export async function checkBackend({
  config,
  minio,
  npmArgs,
  npmInvocation,
  postgres,
  report,
  startManagedProcess,
}) {
  report.addSection('Backend');

  const expectedStatus = postgres.dependencyOk && minio.dependencyOk ? 200 : 503;
  let response = await fetchHealth({ config });
  let started = false;

  if (!response.reachable) {
    const processStarted = await startManagedProcess(
      'backend',
      npmInvocation.command,
      [
        ...npmInvocation.argsPrefix,
        ...npmArgs(['run', 'start', '--workspace', 'backend']),
      ],
      {
        ports: [config.backend.port],
      },
    );

    if (!processStarted.ok) {
      report.add('Backend', 'ERROR', `Failed to start: ${processStarted.message}`);
      return { ok: false };
    }

    started = true;
    report.add(
      'Backend',
      'INFO',
      'Backend process started; waiting for health endpoint',
    );
    response = await waitForBackendHealth({ config, expectedStatus });
  }

  if (!response.reachable) {
    if (!postgres.dependencyOk || !minio.dependencyOk) {
      const unavailable = [
        !postgres.dependencyOk ? 'PostgreSQL' : null,
        !minio.dependencyOk ? 'MinIO' : null,
      ]
        .filter(Boolean)
        .join(' and ');

      report.add(
        'Backend',
        'SKIP',
        `Backend health check skipped: ${unavailable} is unavailable and backend did not expose /api/health`,
      );
      return { ok: false };
    }

    const message = started
      ? `Health endpoint did not become ready: ${response.message}`
      : `Health endpoint: ${response.message}`;
    report.add('Backend', 'ERROR', message);
    return { ok: false };
  }

  if (response.status !== expectedStatus) {
    report.add(
      'Backend',
      'ERROR',
      `Health endpoint returned ${response.status}, expected ${expectedStatus}`,
    );
    return { ok: false };
  }

  if (started) {
    report.add('Backend', 'STARTED', 'Backend started temporarily');
  }

  report.add('Backend', 'OK', 'Health endpoint');
  addDependencyResult(
    report,
    'PostgreSQL dependency',
    postgres.dependencyOk,
    response.body?.dependencies?.postgres,
  );
  addDependencyResult(
    report,
    'MinIO dependency',
    minio.dependencyOk,
    response.body?.dependencies?.minio,
  );

  return {
    ok:
      response.body?.dependencies?.postgres ===
        (postgres.dependencyOk ? 'ok' : 'error') &&
      response.body?.dependencies?.minio === (minio.dependencyOk ? 'ok' : 'error'),
  };
}

export function addDependencyResult(report, label, expectedOk, actual) {
  const expected = expectedOk ? 'ok' : 'error';

  if (actual === expected) {
    report.add('Backend', 'OK', label);
    return;
  }

  report.add(
    'Backend',
    'ERROR',
    `${label}: got ${actual ?? '<missing>'}, expected ${expected}`,
  );
}

export async function fetchHealth({ config }) {
  const result = await checkBackendHealth({
    config,
    url: config.backend.internalUrl ?? config.backend.url,
  });
  return mapHealthResult(result);
}

export async function waitForBackendHealth({
  config,
  expectedStatus,
  timeoutMs = 45_000,
}) {
  let lastResult = null;

  const result = await waitForBackendHealthOperation({
    checkHealth: async () => {
      const health = await checkBackendHealth({
        config,
        url: config.backend.internalUrl ?? config.backend.url,
      });
      lastResult = health;

      if (isExpectedHealthResult(health, expectedStatus)) {
        return {
          ...health,
          ok: true,
        };
      }

      return health;
    },
    timeoutMs,
  });

  return mapHealthResult(lastResult ?? result);
}

function mapHealthResult(result) {
  return {
    body: result.details?.body,
    code: result.code,
    details: result.details,
    message: result.details?.error ?? result.message,
    reachable: isBackendReachable(result),
    status: result.details?.status,
  };
}

function isExpectedHealthResult(result, expectedStatus) {
  if (result.ok) {
    return true;
  }

  return (
    expectedStatus === 503 &&
    result.code === 'BACKEND_HEALTH_UNAVAILABLE' &&
    result.details?.status === 503
  );
}

function isBackendReachable(result) {
  return Number.isInteger(result.details?.status);
}
