import { failure, success } from '../result.mjs';
import { formatError } from '../security/redaction.mjs';

export async function checkFrontendHttp({
  config,
  fetchImpl = globalThis.fetch,
  requestTimeoutMs = 3_000,
}) {
  if (!Number.isFinite(requestTimeoutMs) || requestTimeoutMs < 0) {
    throw new TypeError(
      'requestTimeoutMs must be a non-negative finite number',
    );
  }

  try {
    if (typeof fetchImpl !== 'function') {
      return failure(
        'FRONTEND_HTTP_UNREACHABLE',
        'Frontend HTTP endpoint is unreachable',
        {
          error: 'fetch implementation is unavailable',
        },
      );
    }

    const response = await fetchImpl(config.frontend.url, {
      signal: AbortSignal.timeout(requestTimeoutMs),
    });

    const contentType = response.headers.get('content-type') ?? '';

    if (!response.ok) {
      return failure(
        'FRONTEND_HTTP_FAILED',
        'Frontend HTTP endpoint failed',
        {
          status: response.status,
        },
      );
    }

    if (!contentType.includes('text/html')) {
      return failure(
        'FRONTEND_CONTENT_TYPE_INVALID',
        'Frontend response is not HTML',
        {
          contentType,
          status: response.status,
        },
      );
    }

    return success(
      'FRONTEND_HTTP_OK',
      'Frontend HTTP endpoint returned HTML',
      {
        contentType,
        status: response.status,
      },
    );
  } catch (error) {
    return failure(
      'FRONTEND_HTTP_UNREACHABLE',
      'Frontend HTTP endpoint is unreachable',
      {
        error: formatError(error),
      },
    );
  }
}

export async function waitForFrontendHttp({
  checkFrontend,
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
    const result = await checkFrontend();

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
