import { spawn } from 'node:child_process';

import { formatError } from '../security/redaction.mjs';

const TERMINATION_CLOSE_TIMEOUT_MS = 1_000;
const TERMINATION_COMMAND_TIMEOUT_MS = 1_000;
const OBSERVED_CLOSE_GRACE_MS = 25;

export function runTerminationCommand(
  command,
  args,
  timeoutMs = TERMINATION_COMMAND_TIMEOUT_MS,
) {
  if (!Number.isFinite(timeoutMs) || timeoutMs < 0) {
    throw new TypeError('timeoutMs must be a non-negative finite number');
  }

  return new Promise((resolveRun) => {
    let closeResolve;
    const closePromise = new Promise((resolveClose) => {
      closeResolve = resolveClose;
    });
    let stderr = '';
    let processError = null;
    let settled = false;
    let timedOut = false;
    let timeout = null;
    let taskkillProcess;

    const settle = (result) => {
      if (settled) {
        return;
      }

      settled = true;
      clearTimeout(timeout);
      resolveRun(result);
    };

    const handleTimeout = async () => {
      timedOut = true;

      if (await waitForObservedChildClose(taskkillProcess, closePromise)) {
        return;
      }

      let delivered = false;

      try {
        delivered = taskkillProcess.kill('SIGKILL');
      } catch (error) {
        if (await waitForObservedChildClose(taskkillProcess, closePromise)) {
          return;
        }

        const cleanupError = processError ?? error;

        settle({
          cleanupFailed: true,
          error: cleanupError,
          message: mergeOutput(
            stderr.trim(),
            `taskkill timed out and could not be terminated: ${formatError(cleanupError)}`,
          ),
          ok: false,
          terminationFailed: true,
        });
        return;
      }

      if (!delivered) {
        if (await waitForObservedChildClose(taskkillProcess, closePromise)) {
          return;
        }

        settle({
          cleanupFailed: true,
          error:
            processError ??
            new Error('taskkill timed out and did not accept SIGKILL'),
          message: mergeOutput(
            stderr.trim(),
            'taskkill timed out and did not accept SIGKILL',
          ),
          ok: false,
          terminationFailed: true,
        });
        return;
      }

      if (await waitForClose(closePromise, TERMINATION_CLOSE_TIMEOUT_MS)) {
        return;
      }

      settle({
        cleanupFailed: true,
        error:
          processError ??
          new Error('taskkill timed out and did not close after SIGKILL'),
        message: mergeOutput(
          stderr.trim(),
          'taskkill timed out and did not close after SIGKILL',
        ),
        ok: false,
        terminationFailed: true,
      });
    };

    try {
      taskkillProcess = spawn(command, args, {
        stdio: ['ignore', 'ignore', 'pipe'],
        windowsHide: true,
      });
    } catch (error) {
      settle({
        error,
        message: formatError(error),
        ok: false,
      });
      return;
    }

    timeout = setTimeout(() => {
      void handleTimeout().catch((error) => {
        settle({
          cleanupFailed: true,
          error,
          message: `taskkill timeout cleanup failed: ${formatError(error)}`,
          ok: false,
          terminationFailed: true,
        });
      });
    }, timeoutMs);

    taskkillProcess.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    taskkillProcess.once('error', (error) => {
      processError = error;

      if (timedOut) {
        return;
      }

      settle({
        error,
        message: formatError(error),
        ok: false,
      });
    });
    taskkillProcess.once('close', (code, signal) => {
      closeResolve({ code, signal });

      if (timedOut) {
        settle({
          cleanupFailed: false,
          error: processError ?? new Error('taskkill timed out'),
          message: mergeOutput(stderr.trim(), 'taskkill timed out'),
          ok: false,
          timedOut: true,
        });
        return;
      }

      settle({
        error: code === 0 ? null : new Error(`taskkill exited with code ${code}`),
        message:
          code === 0
            ? ''
            : mergeOutput(stderr.trim(), `taskkill exited with code ${code}`),
        ok: code === 0,
      });
    });
  });
}

function mergeOutput(...values) {
  return values.filter((value) => value !== '').join('\n');
}

async function waitForObservedChildClose(child, closePromise) {
  if (child.exitCode === null && child.signalCode === null) {
    return false;
  }

  return Boolean(await waitForClose(closePromise, OBSERVED_CLOSE_GRACE_MS));
}

function waitForClose(closePromise, timeoutMs) {
  return new Promise((resolveWait) => {
    const timeout = setTimeout(() => {
      resolveWait(null);
    }, timeoutMs);

    closePromise.then((result) => {
      clearTimeout(timeout);
      resolveWait(result);
    });
  });
}
