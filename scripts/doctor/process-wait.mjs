import { createServer } from 'node:net';

export function waitForExit(child, timeoutMs) {
  if (!Number.isFinite(timeoutMs) || timeoutMs < 0) {
    throw new TypeError('timeoutMs must be a non-negative finite number');
  }

  if (child.exitCode !== null || child.signalCode !== null) {
    return Promise.resolve(true);
  }

  return new Promise((resolveWait) => {
    let settled = false;

    const finish = (result) => {
      if (settled) {
        return;
      }

      settled = true;
      clearTimeout(timeout);
      child.removeListener('exit', handleExit);
      resolveWait(result);
    };

    const handleExit = () => {
      finish(true);
    };

    const timeout = setTimeout(() => {
      finish(false);
    }, timeoutMs);
    child.once('exit', handleExit);
  });
}

export function waitForPortReleased(port, host, timeoutMs) {
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new TypeError('port must be an integer from 1 to 65535');
  }

  if (typeof host !== 'string' || host.length === 0) {
    throw new TypeError('host must be a non-empty string');
  }

  if (!Number.isFinite(timeoutMs) || timeoutMs < 0) {
    throw new TypeError('timeoutMs must be a non-negative finite number');
  }

  const startedAt = Date.now();

  return new Promise((resolveReleased) => {
    const check = () => {
      const server = createServer();

      server.once('error', (error) => {
        if (error.code !== 'EADDRINUSE') {
          resolveReleased(false);
          return;
        }

        const remainingMs = timeoutMs - (Date.now() - startedAt);

        if (remainingMs <= 0) {
          resolveReleased(false);
          return;
        }

        setTimeout(check, Math.min(500, remainingMs));
      });

      server.listen(port, host, () => {
        server.close(() => resolveReleased(true));
      });
    };

    check();
  });
}
