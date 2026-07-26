import { runTerminationCommand } from '../commands/termination-command.mjs';
import { formatError } from '../security/redaction.mjs';

const PROCESS_TERM_GRACE_MS = 2_000;
const PROCESS_KILL_GRACE_MS = 2_000;

export function createResourceRegistry({
  killProcess = process.kill,
  platform = process.platform,
  processKillGraceMs = PROCESS_KILL_GRACE_MS,
  processTermGraceMs = PROCESS_TERM_GRACE_MS,
  runCommand = runTerminationCommand,
} = {}) {
  validateGraceTimeout(processKillGraceMs, 'processKillGraceMs');
  validateGraceTimeout(processTermGraceMs, 'processTermGraceMs');

  const processes = [];
  let cleanupStarted = false;
  let cleanupPromise = null;

  return {
    registerProcess(resource) {
      if (cleanupStarted) {
        throw new Error('Cannot register a resource after cleanup has started');
      }

      const registered = createRegisteredProcess(resource);
      processes.push(registered);
      return registered;
    },
    cleanup() {
      cleanupStarted = true;
      cleanupPromise ??= cleanupProcesses({
        killProcess,
        platform,
        processKillGraceMs,
        processTermGraceMs,
        processes,
        runCommand,
      });
      return cleanupPromise;
    },
  };
}

function validateGraceTimeout(value, name) {
  if (!Number.isFinite(value) || value < 0) {
    throw new TypeError(`${name} must be a non-negative finite number`);
  }
}

function createRegisteredProcess({ child, name }) {
  let closed = false;
  let exited = child.exitCode !== null || child.signalCode !== null;
  let processError = null;
  let closeResolve;
  const closePromise = new Promise((resolveClose) => {
    closeResolve = resolveClose;
  });

  const markClosed = (code = child.exitCode, signal = child.signalCode) => {
    closed = true;
    closeResolve({ code, signal });
  };

  child.once('error', (error) => {
    processError = error;

    if (!child.pid) {
      markClosed(null, null);
    }
  });
  child.once('close', markClosed);
  child.once('exit', () => {
    exited = true;
  });

  return {
    child,
    get closed() {
      return closed;
    },
    get exited() {
      return exited;
    },
    get processError() {
      return processError;
    },
    closePromise,
    name,
  };
}

async function cleanupProcesses({
  killProcess,
  platform,
  processKillGraceMs,
  processTermGraceMs,
  processes,
  runCommand,
}) {
  const results = [];
  let cleanupErrors = 0;
  let resource;

  while ((resource = processes.pop())) {
    let result;

    try {
      result = await stopRegisteredProcess(resource, {
        killProcess,
        platform,
        processKillGraceMs,
        processTermGraceMs,
        runCommand,
      });
    } catch (error) {
      result = {
        error,
        message: `Unable to clean up resource: ${formatError(error)}`,
        ok: false,
      };
    }

    results.push({
      name: resource.name,
      result,
    });

    if (!result.ok) {
      cleanupErrors += 1;
    }
  }

  return {
    cleanupErrors,
    ok: cleanupErrors === 0,
    results,
  };
}

async function stopRegisteredProcess(resource, {
  killProcess,
  platform,
  processKillGraceMs,
  processTermGraceMs,
  runCommand,
}) {
  const { child } = resource;

  if (!child.pid) {
    if (resource.processError || (await waitForClose(resource.closePromise, 100))) {
      return { ok: true };
    }

    return {
      error: new Error('Registered process has no process id'),
      message: 'Registered process has no process id',
      ok: false,
    };
  }

  if (platform === 'win32') {
    const termination = await runCommand('taskkill.exe', [
      '/pid',
      String(child.pid),
      '/t',
      '/f',
    ]);

    if (await waitForClose(resource.closePromise, processKillGraceMs)) {
      return { ok: true };
    }

    if (termination.ok) {
      return {
        error: new Error('Process did not close after taskkill'),
        message: 'Process did not close after taskkill',
        ok: false,
      };
    }

    return {
      error: termination.error,
      message: `Unable to stop process tree: ${termination.message}`,
      ok: false,
    };
  }

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
