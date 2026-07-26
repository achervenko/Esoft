import {
  addStoppedProcessReport,
  stopManagedProcess,
  waitForPortReleased,
} from './processes.mjs';
import { getPostgresServiceState, stopManagedService } from './postgres.mjs';
import {
  getActiveStartupCount,
  getCleanupStateVersion,
  waitForCleanupStateChange,
} from './resource-registry.mjs';
import { formatError } from './utils.mjs';

export function createCleanup({
  cleanupState,
  managedProcesses,
  managedServices,
  report,
  runCaptured,
}) {
  let cleanupPromise = null;

  async function restoreInitialState() {
    cleanupState.started = true;
    let cleanupErrors = 0;

    while (true) {
      cleanupErrors += await drainManagedProcesses({
        managedProcesses,
        report,
      });
      cleanupErrors += await drainManagedServices({
        managedServices,
        report,
        runCaptured,
      });

      const version = getCleanupStateVersion(cleanupState);

      if (managedProcesses.length > 0 || managedServices.length > 0) {
        continue;
      }

      if (getActiveStartupCount(cleanupState) === 0) {
        return { cleanupErrors };
      }

      await waitForCleanupStateChange(cleanupState, version);
    }
  }

  return function cleanupOnce() {
    cleanupPromise ??= restoreInitialState();
    return cleanupPromise;
  };
}

async function drainManagedProcesses({ managedProcesses, report }) {
  let cleanupErrors = 0;
  let processInfo;

  while ((processInfo = managedProcesses.pop())) {
    try {
      const stopped = await stopManagedProcess(processInfo);
      cleanupErrors += addStoppedProcessReport(report, processInfo, stopped);
    } catch (error) {
      cleanupErrors += 1;
      report.add(
        processInfo.name,
        'ERROR',
        `Process cleanup failed: ${formatError(error)}`,
      );
    }

    for (const port of processInfo.ports) {
      try {
        const released = await waitForPortReleased(port, '127.0.0.1', 5_000);

        if (released) {
          report.add(processInfo.name, 'OK', `Port ${port} released`);
        } else {
          cleanupErrors += 1;
          report.add(processInfo.name, 'ERROR', `Port ${port} is still busy`);
        }
      } catch (error) {
        cleanupErrors += 1;
        report.add(
          processInfo.name,
          'ERROR',
          `Port ${port} cleanup failed: ${formatError(error)}`,
        );
      }
    }
  }

  return cleanupErrors;
}

async function drainManagedServices({ managedServices, report, runCaptured }) {
  let cleanupErrors = 0;
  let service;

  while ((service = managedServices.pop())) {
    try {
      const stopped = await stopManagedService(service, {
        getServiceState: (serviceName) =>
          getPostgresServiceState(serviceName, { runCaptured }),
        runCaptured,
      });

      if (stopped) {
        report.add(service.name, 'STOPPED', 'Initial service state restored');
      } else {
        cleanupErrors += 1;
        report.add(service.name, 'ERROR', 'Initial service state was not restored');
      }
    } catch (error) {
      cleanupErrors += 1;
      report.add(
        service.name,
        'ERROR',
        `Service cleanup failed: ${formatError(error)}`,
      );
    }
  }

  return cleanupErrors;
}
