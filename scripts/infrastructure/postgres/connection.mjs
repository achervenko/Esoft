import { failure, success } from '../result.mjs';
import { formatError } from '../security/redaction.mjs';

export async function checkPostgresConnection({
  closeTimeoutMs = 3_000,
  config,
  PgClient,
  queryTimeoutMs = 3_000,
  signal,
  terminateClient = null,
}) {
  let client;
  let closeCompleted = false;
  let closePromise = null;
  let primaryResult = null;

  const beginClose = () => {
    if (!client) {
      closeCompleted = true;
      return Promise.resolve();
    }

    closePromise ??= Promise.resolve()
      .then(() => client.end())
      .then(() => {
        closeCompleted = true;
      });

    return closePromise;
  };

  try {
    client = new PgClient({
      connectionString: config.database.url,
      connectionTimeoutMillis: 3_000,
    });

    const abortConnection = () => {
      if (!client || closePromise) {
        return;
      }

      void beginClose().catch(() => undefined);
    };

    await runPostgresStage(() => client.connect(), {
      onAbort: abortConnection,
      signal,
      stage: 'connect',
      timeoutMs: 3_000,
    });
    await runPostgresStage(() => client.query('SELECT 1'), {
      onAbort: abortConnection,
      signal,
      stage: 'query',
      timeoutMs: queryTimeoutMs,
    });
    primaryResult = success(
      'POSTGRES_CONNECTION_OK',
      'PostgreSQL connection is available',
    );
  } catch (error) {
    primaryResult = failure(
      'POSTGRES_CONNECTION_FAILED',
      'Unable to connect to PostgreSQL',
      {
        error: formatError(error),
      },
    );
  }

  const closeResult = await closeClientOnce({
    beginClose,
    closeCompleted,
    timeoutMs: closeTimeoutMs,
    terminate: () => {
      terminatePostgresClient(client, terminateClient);
    },
  });

  if (!closeResult.ok && primaryResult.ok) {
    return closeResult;
  }

  if (!closeResult.ok) {
    return failure(
      'POSTGRES_CONNECTION_FAILED',
      'Unable to connect to PostgreSQL',
      {
        closeError: closeResult.details.error,
        error: primaryResult.details.error,
        ...('terminationError' in closeResult.details
          ? { terminationError: closeResult.details.terminationError }
          : {}),
      },
    );
  }

  return primaryResult;
}

export async function waitForPostgres({
  abortCleanupTimeoutMs = 3_500,
  checkConnection,
  intervalMs = 1_000,
  timeoutMs = 30_000,
}) {
  if (!Number.isFinite(abortCleanupTimeoutMs) || abortCleanupTimeoutMs <= 0) {
    throw new TypeError('abortCleanupTimeoutMs must be a positive finite number');
  }

  if (!Number.isFinite(intervalMs) || intervalMs <= 0) {
    throw new TypeError('intervalMs must be a positive finite number');
  }

  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new TypeError('timeoutMs must be a positive finite number');
  }

  const startedAt = Date.now();

  while (true) {
    const remainingBeforeAttempt = timeoutMs - (Date.now() - startedAt);

    if (remainingBeforeAttempt <= 0) {
      return postgresWaitTimeoutFailure();
    }

    const result = await runWithTimeout(
      checkConnection,
      remainingBeforeAttempt,
      abortCleanupTimeoutMs,
    );

    if (result.ok) {
      return result;
    }

    const remainingMs = timeoutMs - (Date.now() - startedAt);

    if (remainingMs <= 0) {
      return postgresWaitTimeoutFailure();
    }

    await delay(Math.min(intervalMs, remainingMs));
  }
}

function delay(ms) {
  return new Promise((resolveDelay) => {
    setTimeout(resolveDelay, ms);
  });
}

async function runWithTimeout(operation, timeoutMs, abortCleanupTimeoutMs) {
  const abortController = new AbortController();
  let timer;

  const operationPromise = Promise.resolve()
    .then(() => operation({ signal: abortController.signal }))
    .catch((error) =>
      failure(
        'POSTGRES_CONNECTION_FAILED',
        'Unable to connect to PostgreSQL',
        {
          error: formatError(error),
        },
      ),
    );
  const operationRacePromise = operationPromise.then((result) => ({
    kind: 'operation',
    result,
  }));

  const timeoutPromise = new Promise((resolveTimeout) => {
    timer = setTimeout(() => {
      abortController.abort();
      resolveTimeout({ kind: 'timeout' });
    }, timeoutMs);
  });

  const winner = await Promise.race([operationRacePromise, timeoutPromise]);
  clearTimeout(timer);

  if (winner.kind === 'operation') {
    return winner.result;
  }

  await waitForAbortCleanup(operationPromise, abortCleanupTimeoutMs);
  return postgresWaitTimeoutFailure();
}

async function closeClientOnce({
  beginClose,
  closeCompleted,
  terminate,
  timeoutMs,
}) {
  if (closeCompleted) {
    return success('POSTGRES_CLIENT_CLOSED', 'PostgreSQL client closed');
  }

  try {
    await runPostgresStage(beginClose, {
      onAbort: () => {
        terminate();
      },
      stage: 'close',
      timeoutMs,
    });
    return success('POSTGRES_CLIENT_CLOSED', 'PostgreSQL client closed');
  } catch (error) {
    return failure(
      'POSTGRES_CONNECTION_FAILED',
      'Unable to connect to PostgreSQL',
      closeFailureDetails(error),
    );
  }
}

function terminatePostgresClient(client, terminateClient) {
  if (typeof terminateClient !== 'function') {
    return;
  }

  terminateClient(client);
}

function runPostgresStage(operation, {
  onAbort = () => {},
  signal,
  stage,
  timeoutMs,
}) {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new TypeError(`${stage} timeoutMs must be a positive finite number`);
  }

  return new Promise((resolveStage, rejectStage) => {
    let settled = false;
    let timeout;

    const finish = (callback, value) => {
      if (settled) {
        return;
      }

      settled = true;
      clearTimeout(timeout);
      signal?.removeEventListener('abort', handleAbort);
      callback(value);
    };

    const abortStage = (error) => {
      try {
        onAbort();
      } catch (abortError) {
        error.abortError = abortError;
      }

      finish(rejectStage, error);
    };

    const handleAbort = () => {
      abortStage(new Error(`PostgreSQL ${stage} aborted`));
    };

    if (signal?.aborted) {
      handleAbort();
      return;
    }

    timeout = setTimeout(() => {
      abortStage(new Error(`PostgreSQL ${stage} timed out`));
    }, timeoutMs);

    signal?.addEventListener('abort', handleAbort, { once: true });

    Promise.resolve()
      .then(operation)
      .then(
        (value) => finish(resolveStage, value),
        (error) => finish(rejectStage, error),
      );
  });
}

async function waitForAbortCleanup(operationPromise, timeoutMs) {
  let timer;

  try {
    await Promise.race([
      operationPromise,
      new Promise((resolveTimeout) => {
        timer = setTimeout(resolveTimeout, timeoutMs);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

function closeFailureDetails(error) {
  return {
    error: formatError(error),
    ...(error && typeof error === 'object' && 'abortError' in error
      ? { terminationError: formatError(error.abortError) }
      : {}),
  };
}

function postgresWaitTimeoutFailure() {
  return failure(
    'POSTGRES_CONNECTION_TIMEOUT',
    'Timed out while waiting for PostgreSQL connection',
  );
}
