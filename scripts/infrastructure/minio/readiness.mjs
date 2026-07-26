import { failure, success } from '../result.mjs';
import {
  formatError,
  redactSensitiveText,
} from '../security/redaction.mjs';

export async function checkMinioReadiness({
  config,
  fetchImpl = globalThis.fetch,
  requestTimeoutMs = 3_000,
  signal,
}) {
  if (!Number.isFinite(requestTimeoutMs) || requestTimeoutMs <= 0) {
    throw new TypeError(
      'requestTimeoutMs must be a positive finite number',
    );
  }

  const endpoint = config.minio.endpoint.replace(/\/+$/, '');
  const url = config.minio.healthUrl ?? `${endpoint}/minio/health/live`;
  const safeEndpoint = redactSensitiveText(config.minio.endpoint);

  try {
    if (typeof fetchImpl !== 'function') {
      return failure(
        'MINIO_READINESS_FAILED',
        'Unable to check MinIO readiness',
        {
          endpoint: safeEndpoint,
          error: 'fetch implementation is unavailable',
        },
      );
    }

    const requestAbort = createAbortSignalProxy({ signal });
    let response;

    try {
      response = await runFetchWithTimeout(
        fetchImpl(url, {
          signal: requestAbort.signal,
        }),
        {
          onTimeout: () => {
            requestAbort.abort(new Error('MinIO readiness request timed out'));
          },
          timeoutMs: requestTimeoutMs,
        },
      );
    } finally {
      requestAbort.dispose();
    }

    if (response.ok) {
      return success('MINIO_READINESS_OK', 'MinIO is ready', {
        endpoint: safeEndpoint,
        status: response.status,
      });
    }

    return failure('MINIO_READINESS_FAILED', 'MinIO is not ready', {
      endpoint: safeEndpoint,
      status: response.status,
    });
  } catch (error) {
    return failure('MINIO_READINESS_FAILED', 'MinIO is not ready', {
      endpoint: safeEndpoint,
      error: formatError(error),
    });
  }
}

function runFetchWithTimeout(fetchPromise, { onTimeout, timeoutMs }) {
  let timeout;
  let timedOut = false;

  fetchPromise.catch(() => {
    // The timeout branch may win the race; late fetch rejections are still observed.
  });

  return Promise.race([
    fetchPromise,
    new Promise((_resolve, reject) => {
      timeout = setTimeout(() => {
        timedOut = true;
        reject(new Error('MinIO readiness request timed out'));
        onTimeout();
      }, timeoutMs);
    }),
  ]).finally(() => {
    if (!timedOut) {
      clearTimeout(timeout);
    }
  });
}

export async function waitForMinioReadiness({
  checkReadiness,
  intervalMs = 1_000,
  signal,
  timeoutMs = 30_000,
}) {
  if (!Number.isFinite(intervalMs) || intervalMs <= 0) {
    throw new TypeError('intervalMs must be a positive finite number');
  }

  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new TypeError('timeoutMs must be a positive finite number');
  }

  const startedAt = Date.now();

  while (true) {
    if (signal?.aborted) {
      return minioReadinessAbortedFailure();
    }

    const remainingBeforeAttempt = timeoutMs - (Date.now() - startedAt);

    if (remainingBeforeAttempt <= 0) {
      return minioReadinessTimeoutFailure();
    }

    const result = await runWithTimeout(
      checkReadiness,
      remainingBeforeAttempt,
      signal,
    );

    if (result.ok) {
      return result;
    }

    const remainingMs = timeoutMs - (Date.now() - startedAt);

    if (remainingMs <= 0) {
      return minioReadinessTimeoutFailure();
    }

    const delayed = await delay(Math.min(intervalMs, remainingMs), signal);

    if (!delayed) {
      return minioReadinessAbortedFailure();
    }
  }
}

function delay(ms, signal) {
  if (signal?.aborted) {
    return Promise.resolve(false);
  }

  return new Promise((resolveDelay) => {
    const handleAbort = () => {
      clearTimeout(timeout);
      resolveDelay(false);
    };
    const timeout = setTimeout(() => {
      signal?.removeEventListener('abort', handleAbort);
      resolveDelay(true);
    }, ms);

    signal?.addEventListener('abort', handleAbort, { once: true });
  });
}

function runWithTimeout(operation, timeoutMs, signal) {
  const abortController = new AbortController();
  let timer;
  let abortResolve;
  const abortPromise = new Promise((resolveAbort) => {
    abortResolve = resolveAbort;
  });

  const handleAbort = () => {
    abortResolve(minioReadinessAbortedFailure());
    abortController.abort(signal.reason);
  };

  if (signal?.aborted) {
    handleAbort();
  } else {
    signal?.addEventListener('abort', handleAbort, { once: true });
  }

  return Promise.race([
    Promise.resolve()
      .then(() => operation({ signal: abortController.signal }))
      .catch((error) =>
        failure(
          'MINIO_READINESS_FAILED',
          'Unable to check MinIO readiness',
          {
            error: formatError(error),
          },
        ),
      ),
    new Promise((resolveTimeout) => {
      timer = setTimeout(() => {
        resolveTimeout(minioReadinessTimeoutFailure());
        abortController.abort();
      }, timeoutMs);
    }),
    abortPromise,
  ]).finally(() => {
    clearTimeout(timer);
    signal?.removeEventListener('abort', handleAbort);
  });
}

function createAbortSignalProxy({ signal }) {
  const abortController = new AbortController();

  const handleAbort = () => {
    abortController.abort(signal.reason);
  };

  if (signal?.aborted) {
    handleAbort();
  } else {
    signal?.addEventListener('abort', handleAbort, { once: true });
  }

  return {
    abort(reason) {
      abortController.abort(reason);
    },
    dispose() {
      signal?.removeEventListener('abort', handleAbort);
    },
    signal: abortController.signal,
  };
}

function minioReadinessTimeoutFailure() {
  return failure(
    'MINIO_READINESS_TIMEOUT',
    'Timed out while waiting for MinIO readiness',
  );
}

function minioReadinessAbortedFailure() {
  return failure(
    'MINIO_READINESS_ABORTED',
    'MinIO readiness wait was aborted',
  );
}
