import { spawn } from 'node:child_process';

import { createSpawnConfig } from '../infrastructure/commands/spawn-config.mjs';
import { runCommand as runInfrastructureCommand } from '../infrastructure/commands/run-command.mjs';
import { formatError } from '../infrastructure/security/redaction.mjs';
import {
  beginStartupOperation,
  notifyCleanupStateChanged,
} from './resource-registry.mjs';
import { stopManagedProcess } from './process-stop.mjs';
import { displayName } from './utils.mjs';

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

    const platform = options.platform ?? process.platform;
    const spawnConfig = createSpawnConfig(
      command,
      args,
      platform,
      options.comSpec,
    );
    const child = spawnProcess(spawnConfig.command, spawnConfig.args, {
      cwd: options.cwd ?? projectRoot,
      detached: platform !== 'win32',
      env: options.env ?? process.env,
      shell: false,
      stdio: 'inherit',
      windowsHide: true,
      windowsVerbatimArguments: spawnConfig.windowsVerbatimArguments,
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
