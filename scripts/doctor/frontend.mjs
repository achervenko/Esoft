import { delay, formatError } from './utils.mjs';

export async function checkFrontend({
  config,
  npm,
  npmScriptArgs,
  report,
  startManagedProcess,
}) {
  report.addSection('Frontend');

  let response = await fetchFrontend({ config });

  if (!response.reachable) {
    const processStarted = await startManagedProcess(
      'frontend',
      npm,
      npmScriptArgs('dev', 'frontend'),
      {
        ports: [config.frontend.port],
      },
    );

    if (!processStarted.ok) {
      report.add('Frontend', 'ERROR', `Failed to start: ${processStarted.message}`);
      return { ok: false };
    }

    report.add('Frontend', 'STARTED', 'Frontend started temporarily');
    response = await waitForFrontend(30_000, { config });
  }

  if (!response.reachable) {
    report.add('Frontend', 'ERROR', `HTTP response: ${response.message}`);
    return { ok: false };
  }

  if (!response.ok) {
    report.add('Frontend', 'ERROR', `HTTP status ${response.status}`);
    return { ok: false };
  }

  report.add('Frontend', 'OK', 'HTML response');

  if (!response.contentType.includes('text/html')) {
    report.add(
      'Frontend',
      'ERROR',
      `Content-Type is ${response.contentType || '<empty>'}, expected text/html`,
    );
    return { ok: false };
  }

  report.add('Frontend', 'OK', 'Content-Type: text/html');
  return { ok: true };
}

export async function fetchFrontend({ config }) {
  try {
    const response = await fetch(config.frontend.url, {
      signal: AbortSignal.timeout(3_000),
    });

    return {
      contentType: response.headers.get('content-type') ?? '',
      ok: response.ok,
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

export async function waitForFrontend(timeoutMs, { config }) {
  const startedAt = Date.now();
  let lastResponse = null;

  do {
    const response = await fetchFrontend({ config });

    if (response.reachable) {
      return response;
    }

    lastResponse = response;
    await delay(1_000);
  } while (Date.now() - startedAt < timeoutMs);

  return lastResponse ?? { message: 'HTTP endpoint did not become ready', reachable: false };
}
