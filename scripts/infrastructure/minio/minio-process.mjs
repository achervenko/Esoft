import { spawn } from 'node:child_process';

import { runTerminationCommand } from '../commands/termination-command.mjs';
import { formatError } from '../security/redaction.mjs';
import { waitForMinioReadiness } from './readiness.mjs';

const UNREGISTERED_PROCESS_CLOSE_MS = 1_000;

export function spawnMinio({
  config,
  platform = process.platform,
  spawnImpl = spawn,
}) {
  return spawnImpl(
    config.minio.executable,
    [
      'server',
      config.minio.dataDir,
      '--address',
      formatHostPort(config.minio.host, config.minio.port),
      '--console-address',
      formatHostPort(config.minio.host, config.minio.consolePort),
    ],
    {
      detached: platform !== 'win32',
      env: {
        ...process.env,
        MINIO_ROOT_PASSWORD: config.minio.rootPassword,
        MINIO_ROOT_USER: config.minio.rootUser,
      },
      shell: false,
      stdio: ['ignore', 'ignore', 'pipe'],
      windowsHide: true,
    },
  );
}

export function waitForSpawn(child) {
  return new Promise((resolveStart) => {
    let settled = false;

    const finish = (result) => {
      if (settled) {
        return;
      }

      settled = true;
      child.removeListener('spawn', handleSpawn);
      child.removeListener('error', handleError);
      child.removeListener('exit', handleExit);
      child.removeListener('close', handleExit);
      resolveStart(result);
    };

    const handleSpawn = () => {
      finish({ ok: true });
    };
    const handleError = (error) => {
      finish({ error, ok: false });
    };
    const handleExit = (code, signal) => {
      finish({
        error: new Error(formatExit('MinIO exited before startup completed', code, signal)),
        ok: false,
      });
    };

    child.once('spawn', handleSpawn);
    child.once('error', handleError);
    child.once('exit', handleExit);
    child.once('close', handleExit);

    if (child.exitCode !== null || child.signalCode !== null) {
      handleExit(child.exitCode, child.signalCode);
    } else if (child.pid !== undefined) {
      handleSpawn();
    }
  });
}

export async function waitForTemporaryMinioReadiness({
  checkReadiness,
  closePromise,
  config,
  readinessTimeoutMs,
}) {
  const abortController = new AbortController();

  try {
    return await Promise.race([
      waitForMinioReadiness({
        checkReadiness: ({ signal }) => checkReadiness({ config, signal }),
        signal: abortController.signal,
        timeoutMs: readinessTimeoutMs,
      }).then((readinessResult) => ({
        result: readinessResult,
      })),
      closePromise.then(({ code, signal }) => {
        abortController.abort();
        return {
          closed: true,
          code,
          signal,
        };
      }),
    ]);
  } finally {
    abortController.abort();
  }
}

export async function terminateUnregisteredMinioProcess(
  child,
  {
    killProcess = process.kill,
    platform = process.platform,
    runCommand = runTerminationCommand,
    timeoutMs = UNREGISTERED_PROCESS_CLOSE_MS,
  } = {},
) {
  try {
    validateTimeoutMs(timeoutMs);

    if (!child.pid) {
      return { ok: await waitForChildClose(child, Math.min(timeoutMs, 100)) };
    }

    if (platform === 'win32') {
      const termination = await runCommand('taskkill.exe', [
        '/pid',
        String(child.pid),
        '/t',
        '/f',
      ]);

      if (await waitForChildClose(child, timeoutMs)) {
        return { ok: true };
      }

      return termination.ok
        ? {
            message: 'Unregistered MinIO process did not close after taskkill',
            ok: false,
          }
        : {
            message: `Unable to terminate unregistered MinIO process: ${termination.message}`,
            ok: false,
          };
    }

    const delivered = signalProcessGroup(child.pid, 'SIGKILL', killProcess);

    if (delivered.missing) {
      return { ok: true };
    }

    if (delivered.error) {
      return {
        message: `Unable to terminate unregistered MinIO process tree: ${formatError(delivered.error)}`,
        ok: false,
      };
    }

    return (await waitForProcessGroupExit(child.pid, timeoutMs, killProcess))
      ? { ok: true }
      : {
          message: 'Unregistered MinIO process tree did not close after SIGKILL',
          ok: false,
        };
  } catch (error) {
    return {
      message: `Unable to terminate unregistered MinIO process: ${formatError(error)}`,
      ok: false,
    };
  }
}

export function formatExit(message, code, signal) {
  if (code !== null && code !== undefined) {
    return `${message} with code ${code}`;
  }

  if (signal) {
    return `${message} with signal ${signal}`;
  }

  return message;
}

function formatHostPort(host, port) {
  const formattedHost =
    host.includes(':') && !host.startsWith('[') ? `[${host}]` : host;

  return `${formattedHost}:${port}`;
}

function validateTimeoutMs(value) {
  if (!Number.isFinite(value) || value <= 0) {
    throw new TypeError('timeoutMs must be a positive finite number');
  }
}

function signalProcessGroup(pid, signal, killProcess) {
  try {
    killProcess(-pid, signal);
    return { delivered: true };
  } catch (error) {
    if (error?.code === 'ESRCH') {
      return { delivered: false, missing: true };
    }

    return { delivered: false, error };
  }
}

async function waitForProcessGroupExit(pid, timeoutMs, killProcess) {
  const startedAt = Date.now();

  while (true) {
    const status = signalProcessGroup(pid, 0, killProcess);

    if (status.missing) {
      return true;
    }

    if (status.error) {
      throw status.error;
    }

    const remainingMs = timeoutMs - (Date.now() - startedAt);

    if (remainingMs <= 0) {
      return false;
    }

    await delay(Math.min(50, remainingMs));
  }
}

function waitForChildClose(child, timeoutMs) {
  return new Promise((resolveWait) => {
    let settled = false;
    const timeout = setTimeout(() => {
      cleanup(false);
    }, timeoutMs);

    const handleClose = () => {
      cleanup(true);
    };

    const cleanup = (result) => {
      if (settled) {
        return;
      }

      settled = true;
      clearTimeout(timeout);
      child.removeListener('close', handleClose);
      child.removeListener('exit', handleClose);
      resolveWait(result);
    };

    child.once('close', handleClose);
    child.once('exit', handleClose);

    if (child.exitCode !== null || child.signalCode !== null) {
      cleanup(true);
    }
  });
}

function delay(ms) {
  return new Promise((resolveDelay) => {
    setTimeout(resolveDelay, ms);
  });
}
