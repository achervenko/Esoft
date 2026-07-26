import { formatError } from '../security/redaction.mjs';
import { runTerminationCommand } from './termination-command.mjs';

const TERMINATION_CLOSE_TIMEOUT_MS = 1_000;
const OBSERVED_CLOSE_GRACE_MS = 25;

export async function terminateTimedOutChild(child, closePromise) {
  if (!child.pid) {
    return {
      error: new Error('Timed out command has no process id'),
      message: 'Timed out command has no process id',
      ok: false,
    };
  }

  if (await waitForObservedChildClose(child, closePromise)) {
    return { ok: true };
  }

  if (process.platform === 'win32') {
    const result = await runTerminationCommand('taskkill.exe', [
      '/pid',
      String(child.pid),
      '/t',
      '/f',
    ]);

    if (!result.ok) {
      if (await waitForObservedChildClose(child, closePromise)) {
        return { ok: true };
      }

      return {
        error: result.error,
        message: `Unable to terminate timed out command: ${result.message}`,
        ok: false,
      };
    }

    return waitForTimedOutChildClose(closePromise);
  }

  let delivered;

  try {
    delivered = killPosixProcessGroup(child.pid, 'SIGKILL');
  } catch (error) {
    if (await waitForObservedChildClose(child, closePromise)) {
      return { ok: true };
    }

    return {
      error,
      message: `Unable to terminate timed out command tree: ${formatError(error)}`,
      ok: false,
    };
  }

  if (!delivered) {
    if (await waitForObservedChildClose(child, closePromise)) {
      return { ok: true };
    }

    return {
      error: new Error('Timed out command tree did not accept SIGKILL'),
      message: 'Timed out command tree did not accept SIGKILL',
      ok: false,
    };
  }

  return waitForTimedOutChildClose(closePromise);
}

export function killPosixProcessGroup(pid, signal) {
  try {
    process.kill(-pid, signal);
    return true;
  } catch (error) {
    if (error?.code === 'ESRCH') {
      return false;
    }

    throw error;
  }
}

export async function waitForObservedChildClose(child, closePromise) {
  if (child.exitCode === null && child.signalCode === null) {
    return false;
  }

  return Boolean(await waitForClose(closePromise, OBSERVED_CLOSE_GRACE_MS));
}

export function waitForClose(closePromise, timeoutMs) {
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

async function waitForTimedOutChildClose(closePromise) {
  if (await waitForClose(closePromise, TERMINATION_CLOSE_TIMEOUT_MS)) {
    return { ok: true };
  }

  return {
    error: new Error('Timed out command did not close after termination'),
    message: 'Timed out command did not close after termination',
    ok: false,
  };
}
