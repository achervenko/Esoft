import { spawn } from 'node:child_process';
import { createServer } from 'node:net';

import { runCommand as runInfrastructureCommand } from '../infrastructure/commands/run-command.mjs';
import {
  beginStartupOperation,
  notifyCleanupStateChanged,
} from './resource-registry.mjs';
import { displayName, formatError } from './utils.mjs';

export async function startManagedProcess(
  name,
  command,
  args,
  {
    cleanupState,
    isShuttingDown,
    managedProcesses,
    projectRoot,
    report,
    ...options
  },
) {
  let finishStartup = () => undefined;

  try {
    finishStartup = beginStartupOperation(cleanupState);
    const spawnProcess = options.spawnImpl ?? spawn;
    const stopProcess = options.stopProcess ?? stopManagedProcess;

    if (isShuttingDown()) {
      return {
        message: 'Shutdown started before process startup completed',
        ok: false,
      };
    }

    const child = spawnProcess(command, args, {
      cwd: options.cwd ?? projectRoot,
      detached: process.platform !== 'win32',
      env: options.env ?? process.env,
      shell: false,
      stdio: 'inherit',
      windowsHide: true,
      windowsVerbatimArguments: false,
    });

    const processInfo = {
      child,
      name,
      ports: options.ports ?? [],
    };
    child.once('exit', (code, signal) => {
      if (isShuttingDown()) {
        return;
      }

      if (code !== null) {
        report.add(name, 'ERROR', `Exited unexpectedly with code ${code}`);
      } else if (signal) {
        report.add(name, 'ERROR', `Exited unexpectedly with signal ${signal}`);
      }
    });

    const started = await new Promise((resolveStarted) => {
      const handleSpawn = () => {
        child.removeListener('error', handleError);
        resolveStarted({ ok: true });
      };

      const handleError = (error) => {
        child.removeListener('spawn', handleSpawn);
        resolveStarted({ message: formatError(error), ok: false });
      };

      child.once('spawn', handleSpawn);
      child.once('error', handleError);
    });

    if (!started.ok) {
      return started;
    }

    if (child.exitCode !== null || child.signalCode !== null) {
      const startupError =
        child.exitCode !== null
          ? `Process exited during startup with code ${child.exitCode}`
          : `Process exited during startup with signal ${child.signalCode}`;
      const cleanupError = await cleanupUnregisteredProcess(
        processInfo,
        stopProcess,
      );

      return {
        message: appendCleanupError(startupError, cleanupError),
        ok: false,
      };
    }

    if (
      !registerManagedResource(
        managedProcesses,
        processInfo,
        isShuttingDown,
        cleanupState,
      )
    ) {
      const cleanupError = await cleanupUnregisteredProcess(
        processInfo,
        stopProcess,
      );
      const startupError = 'Shutdown started before process startup completed';

      return {
        message: appendCleanupError(startupError, cleanupError),
        ok: false,
      };
    }

    return { ok: true };
  } catch (error) {
    return { message: formatError(error), ok: false };
  } finally {
    finishStartup();
  }
}

export async function stopManagedProcess(processInfo, {
  groupPollIntervalMs = 100,
  killGraceMs = 2_000,
  killProcess = process.kill,
  platform = process.platform,
  runCommand = runInfrastructureCommand,
  terminationGraceMs = 3_000,
} = {}) {
  const { child } = processInfo;

  if (!child.pid) {
    return true;
  }

  if (platform === 'win32') {
    const result = await runCommand(
      'taskkill.exe',
      ['/pid', String(child.pid), '/t', '/f'],
      {
        timeoutMs: 10_000,
      },
    ).catch(() => ({ ok: false }));

    await waitForExit(child, 3_000);
    return child.exitCode !== null || child.signalCode !== null || result.ok;
  }

  if (!isProcessGroupRunning(child.pid, killProcess)) {
    return true;
  }

  try {
    killProcess(-child.pid, 'SIGTERM');
  } catch (error) {
    return isProcessMissingError(error);
  }

  await waitForProcessGroupExit(
    child.pid,
    terminationGraceMs,
    groupPollIntervalMs,
    killProcess,
  );

  if (isProcessGroupRunning(child.pid, killProcess)) {
    try {
      killProcess(-child.pid, 'SIGKILL');
    } catch (error) {
      return isProcessMissingError(error);
    }

    await waitForProcessGroupExit(
      child.pid,
      killGraceMs,
      groupPollIntervalMs,
      killProcess,
    );
  }

  return !isProcessGroupRunning(child.pid, killProcess);
}

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

export function runCaptured(command, args, options = {}) {
  return runInfrastructureCommand(command, args, options);
}

export function addStoppedProcessReport(report, processInfo, stopped) {
  if (stopped) {
    report.add(processInfo.name, 'STOPPED', `${displayName(processInfo.name)} stopped`);
    return 0;
  }

  report.add(processInfo.name, 'ERROR', `${displayName(processInfo.name)} cleanup failed`);
  return 1;
}

function isProcessMissingError(error) {
  return (
    error &&
    typeof error === 'object' &&
    error.code === 'ESRCH'
  );
}

async function cleanupUnregisteredProcess(processInfo, stopProcess) {
  try {
    const stopped = await stopProcess(processInfo);

    return stopped
      ? null
      : 'Process cleanup failed after startup was cancelled';
  } catch (error) {
    return `Process cleanup failed: ${formatError(error)}`;
  }
}

function appendCleanupError(message, cleanupError) {
  return cleanupError ? `${message}; ${cleanupError}` : message;
}

function isProcessGroupRunning(pid, killProcess) {
  try {
    killProcess(-pid, 0);
    return true;
  } catch (error) {
    if (isProcessMissingError(error)) {
      return false;
    }

    throw error;
  }
}

async function waitForProcessGroupExit(
  pid,
  timeoutMs,
  intervalMs,
  killProcess,
) {
  if (!Number.isFinite(timeoutMs) || timeoutMs < 0) {
    throw new TypeError('timeoutMs must be a non-negative finite number');
  }

  if (!Number.isFinite(intervalMs) || intervalMs <= 0) {
    throw new TypeError('intervalMs must be a positive finite number');
  }

  const startedAt = Date.now();

  while (true) {
    if (!isProcessGroupRunning(pid, killProcess)) {
      return true;
    }

    const remainingMs = timeoutMs - (Date.now() - startedAt);

    if (remainingMs <= 0) {
      return false;
    }

    await new Promise((resolveDelay) => {
      setTimeout(resolveDelay, Math.min(intervalMs, remainingMs));
    });
  }
}

function removeManagedProcess(managedProcesses, processInfo) {
  const index = managedProcesses.indexOf(processInfo);

  if (index !== -1) {
    managedProcesses.splice(index, 1);
  }
}

function registerManagedResource(
  managedResources,
  resource,
  isShuttingDown,
  cleanupState,
) {
  if (isShuttingDown()) {
    return false;
  }

  managedResources.push(resource);
  notifyCleanupStateChanged(cleanupState);

  if (!isShuttingDown()) {
    return true;
  }

  removeManagedProcess(managedResources, resource);
  notifyCleanupStateChanged(cleanupState);
  return false;
}
