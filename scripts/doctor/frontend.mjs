import {
  checkFrontendHttp,
  waitForFrontendHttp,
} from '../infrastructure/http/frontend-health.mjs';

export async function checkFrontend({
  config,
  npm,
  npmScriptArgs,
  report,
  startManagedProcess,
}) {
  report.addSection('Frontend');

  let response = await fetchFrontend({ config });
  let started = false;

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

    started = true;
    report.add(
      'Frontend',
      'INFO',
      'Frontend process started; waiting for HTTP endpoint',
    );
    response = await waitForFrontend({ config });
  }

  if (!response.reachable) {
    report.add('Frontend', 'ERROR', `HTTP response: ${response.message}`);
    return { ok: false };
  }

  if (!response.ok) {
    if (response.code === 'FRONTEND_CONTENT_TYPE_INVALID') {
      report.add(
        'Frontend',
        'ERROR',
        `Content-Type is ${response.contentType || '<empty>'}, expected text/html`,
      );
    } else if (response.code === 'FRONTEND_HTTP_FAILED') {
      report.add('Frontend', 'ERROR', `HTTP status ${response.status}`);
    } else {
      report.add('Frontend', 'ERROR', response.message);
    }

    return { ok: false };
  }

  if (started) {
    report.add('Frontend', 'STARTED', 'Frontend started temporarily');
  }

  report.add('Frontend', 'OK', 'HTML response');
  report.add('Frontend', 'OK', 'Content-Type: text/html');
  return { ok: true };
}

export async function fetchFrontend({ config }) {
  const result = await checkFrontendHttp({ config });
  return mapFrontendResult(result);
}

export async function waitForFrontend({ config, timeoutMs = 30_000 }) {
  const result = await waitForFrontendHttp({
    checkFrontend: () => checkFrontendHttp({ config }),
    timeoutMs,
  });

  return mapFrontendResult(result);
}

function mapFrontendResult(result) {
  return {
    code: result.code,
    contentType: result.details?.contentType ?? '',
    details: result.details,
    message: result.details?.error ?? result.message,
    ok: result.ok,
    reachable: Number.isInteger(result.details?.status),
    status: result.details?.status,
  };
}
