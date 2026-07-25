import { delay, formatError } from './utils.mjs';

export async function checkBackend({
  config,
  minio,
  npm,
  npmScriptArgs,
  postgres,
  report,
  startManagedProcess,
}) {
  report.addSection('Backend');

  let response = await fetchHealth({ config });
  let started = false;

  if (!response.reachable) {
    const processStarted = await startManagedProcess(
      'backend',
      npm,
      npmScriptArgs('start', 'backend'),
      {
        ports: [config.backend.port],
      },
    );

    if (!processStarted.ok) {
      report.add('Backend', 'ERROR', `Failed to start: ${processStarted.message}`);
      return { ok: false };
    }

    started = true;
    report.add('Backend', 'STARTED', 'Backend started temporarily');
    response = await waitForBackendHealth(45_000, { config });
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
        `Backend health check skipped: ${unavailable} is unavailable and backend did not expose /health`,
      );
      return { ok: false };
    }

    const message = started
      ? `Health endpoint did not become ready: ${response.message}`
      : `Health endpoint: ${response.message}`;
    report.add('Backend', 'ERROR', message);
    return { ok: false };
  }

  const expectedStatus = postgres.dependencyOk && minio.dependencyOk ? 200 : 503;

  if (response.status !== expectedStatus) {
    report.add(
      'Backend',
      'ERROR',
      `Health endpoint returned ${response.status}, expected ${expectedStatus}`,
    );
    return { ok: false };
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
  try {
    const response = await fetch(`${config.backend.url}/health`, {
      signal: AbortSignal.timeout(3_000),
    });
    const contentType = response.headers.get('content-type') ?? '';
    const body = contentType.includes('application/json')
      ? await response.json().catch(() => null)
      : null;

    return {
      body,
      reachable: true,
      status: response.status,
    };
  } catch (error) {
    return {
      message: formatError(error),
      reachable: false,
    };
  }
}

export async function waitForBackendHealth(timeoutMs, { config }) {
  const startedAt = Date.now();
  let lastResponse = null;

  do {
    const response = await fetchHealth({ config });

    if (response.reachable) {
      return response;
    }

    lastResponse = response;
    await delay(1_000);
  } while (Date.now() - startedAt < timeoutMs);

  return lastResponse ?? { message: 'Health endpoint did not become ready', reachable: false };
}
