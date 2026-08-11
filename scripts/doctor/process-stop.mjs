import { runCommand as runInfrastructureCommand } from '../infrastructure/commands/run-command.mjs';
import { waitForExit as waitForExitOperation } from './process-wait.mjs';

// Doctor-only cleanup for temporary child processes. Windows intentionally uses
// forced taskkill here; production service shutdown needs a graceful stop path.
export async function stopManagedProcess(processInfo, {
  groupPollIntervalMs = 100,
  killGraceMs = 2_000,
  killProcess = process.kill,
  platform = process.platform,
  runCommand = runInfrastructureCommand,
  terminationGraceMs = 3_000,
  waitForExit = waitForExitOperation,
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

    const exited = await waitForExit(child, 3_000);
    return exited || child.exitCode !== null || child.signalCode !== null;
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

function isProcessMissingError(error) {
  return (
    error &&
    typeof error === 'object' &&
    error.code === 'ESRCH'
  );
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
