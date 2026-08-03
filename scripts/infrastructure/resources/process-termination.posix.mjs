import { formatError } from '../security/redaction.mjs';

export async function stopPosixProcessGroup(resource, {
  killProcess,
  processKillGraceMs,
  processTermGraceMs,
}) {
  const { child } = resource;
  const groupStatus = signalProcessGroup(child.pid, 0, killProcess);

  if (groupStatus.missing) {
    return { ok: true };
  }

  if (groupStatus.error) {
    return {
      error: groupStatus.error,
      message: `Unable to inspect process tree: ${formatError(groupStatus.error)}`,
      ok: false,
    };
  }

  const termResult = signalProcessGroup(child.pid, 'SIGTERM', killProcess);

  if (termResult.delivered) {
    try {
      if (
        await waitForProcessGroupExit(child.pid, processTermGraceMs, killProcess)
      ) {
        return { ok: true };
      }
    } catch (error) {
      return {
        error,
        message: `Unable to inspect process tree after SIGTERM: ${formatError(error)}`,
        ok: false,
      };
    }
  } else if (termResult.missing) {
    return { ok: true };
  } else {
    return {
      error: termResult.error,
      message: `Unable to send SIGTERM to process tree: ${formatError(termResult.error)}`,
      ok: false,
    };
  }

  const killResult = signalProcessGroup(child.pid, 'SIGKILL', killProcess);

  if (killResult.delivered) {
    try {
      if (
        await waitForProcessGroupExit(child.pid, processKillGraceMs, killProcess)
      ) {
        return { ok: true };
      }
    } catch (error) {
      return {
        error,
        message: `Unable to inspect process tree after SIGKILL: ${formatError(error)}`,
        ok: false,
      };
    }

    return {
      error: new Error('Process tree did not close after SIGKILL'),
      message: 'Process tree did not close after SIGKILL',
      ok: false,
    };
  }

  if (killResult.missing) {
    return { ok: true };
  }

  return {
    error: killResult.error,
    message: `Unable to send SIGKILL to process tree: ${formatError(killResult.error)}`,
    ok: false,
  };
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

function delay(ms) {
  return new Promise((resolveDelay) => {
    setTimeout(resolveDelay, ms);
  });
}
