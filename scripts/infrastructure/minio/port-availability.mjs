import { createServer } from 'node:net';

import { failure, success } from '../result.mjs';
import { formatError } from '../security/redaction.mjs';

export async function checkMinioPortsAvailable({
  config,
  createServerImpl = createServer,
}) {
  const { consolePort, host, port } = config.minio;

  if (port === consolePort) {
    return failure(
      'MINIO_PORT_CONFLICT',
      'MinIO API and console ports must be different',
      {
        host,
        port,
      },
    );
  }

  for (const candidatePort of [port, consolePort]) {
    const available = await checkPortAvailable({
      createServerImpl,
      host,
      port: candidatePort,
    });

    if (available.ok) {
      continue;
    }

    if (available.error?.code === 'EADDRINUSE') {
      return failure(
        'MINIO_PORT_CONFLICT',
        'MinIO port is not available',
        {
          host,
          message: formatError(available.error),
          port: candidatePort,
        },
      );
    }

    return failure(
      'MINIO_PORT_CHECK_FAILED',
      'Unable to check MinIO port',
      {
        error: formatError(available.error),
        host,
        port: candidatePort,
      },
    );
  }

  return success('MINIO_PORTS_AVAILABLE', 'MinIO ports are available');
}

export function checkPortAvailable({
  createServerImpl = createServer,
  host,
  port,
}) {
  return new Promise((resolveCheck) => {
    let server;

    try {
      server = createServerImpl();
    } catch (error) {
      resolveCheck({ error, ok: false });
      return;
    }

    let closing = false;
    let settled = false;
    let pendingResult;

    const finish = (result) => {
      if (settled) {
        return;
      }

      settled = true;
      server.removeListener('error', handleError);
      resolveCheck(result);
    };

    const closeAndFinish = (result) => {
      if (!pendingResult || !result.ok) {
        pendingResult = result;
      }

      if (closing) {
        return;
      }

      if (!server.listening) {
        finish(pendingResult);
        return;
      }

      closing = true;

      try {
        server.close((closeError) => {
          closing = false;

          if (closeError && pendingResult?.ok) {
            pendingResult = {
              error: closeError,
              ok: false,
            };
          }

          finish(pendingResult);
        });
      } catch (closeError) {
        closing = false;

        if (pendingResult?.ok) {
          finish({
            error: closeError,
            ok: false,
          });
          return;
        }

        finish(pendingResult);
      }
    };

    const handleError = (error) => {
      closeAndFinish({
        error,
        ok: false,
      });
    };

    try {
      server.on('error', handleError);
      server.listen(port, host, () => {
        closeAndFinish({ ok: true });
      });
    } catch (error) {
      finish({
        error,
        ok: false,
      });
    }
  });
}