import { failure, success } from '../result.mjs';
import { formatError } from '../security/redaction.mjs';

export async function checkBackendHealth({
  config,
  expectedStatus = undefined,
  fetchImpl = globalThis.fetch,
  requestTimeoutMs = 3_000,
}) {
  if (!Number.isFinite(requestTimeoutMs) || requestTimeoutMs < 0) {
    throw new TypeError(
      'requestTimeoutMs must be a non-negative finite number',
    );
  }

  const baseUrl = config.backend.url.replace(/\/+$/, '');

  try {
    if (typeof fetchImpl !== 'function') {
      return failure(
        'BACKEND_HEALTH_UNREACHABLE',
        'Backend health endpoint is unreachable',
        {
          error: 'fetch implementation is unavailable',
        },
      );
    }

    const response = await fetchImpl(`${baseUrl}/health`, {
      signal: AbortSignal.timeout(requestTimeoutMs),
    });
    const contentType = response.headers.get('content-type') ?? '';
    const body = contentType.includes('application/json')
      ? await response.json().catch(() => null)
      : null;

    if (expectedStatus !== undefined) {
      if (response.status === expectedStatus) {
        return success(
          'BACKEND_HEALTH_EXPECTED_STATUS',
          `Backend health returned expected status ${expectedStatus}`,
          {
            body,
            status: response.status,
          },
        );
      }

      return failure(
        'BACKEND_HEALTH_UNEXPECTED_STATUS',
        `Backend health returned ${response.status}, expected ${expectedStatus}`,
        {
          body,
          status: response.status,
        },
      );
    }

    if (response.status === 200) {
      return success('BACKEND_HEALTH_OK', 'Backend is healthy', {
        body,
        status: response.status,
      });
    }

    if (response.status === 503) {
      return failure('BACKEND_HEALTH_UNAVAILABLE', 'Backend is not ready', {
        body,
        status: response.status,
      });
    }

    return failure('BACKEND_HEALTH_FAILED', 'Backend health endpoint failed', {
      body,
      status: response.status,
    });
  } catch (error) {
    return failure('BACKEND_HEALTH_UNREACHABLE', 'Backend health endpoint is unreachable', {
      error: formatError(error),
    });
  }
}

export async function waitForBackendHealth({
  checkHealth,
  intervalMs = 1_000,
  timeoutMs = 30_000,
}) {
  if (!Number.isFinite(intervalMs) || intervalMs <= 0) {
    throw new TypeError('intervalMs must be a positive finite number');
  }

  if (!Number.isFinite(timeoutMs) || timeoutMs < 0) {
    throw new TypeError('timeoutMs must be a non-negative finite number');
  }

  const startedAt = Date.now();

  while (true) {
    const result = await checkHealth();

    if (result.ok) {
      return result;
    }

    const remainingMs = timeoutMs - (Date.now() - startedAt);

    if (remainingMs <= 0) {
      return result;
    }

    await delay(Math.min(intervalMs, remainingMs));
  }
}

function delay(ms) {
  return new Promise((resolveDelay) => {
    setTimeout(resolveDelay, ms);
  });
}
