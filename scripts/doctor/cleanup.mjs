import {
  addStoppedProcessReport,
  stopManagedProcess,
  waitForPortReleased,
} from './processes.mjs';
import { getPostgresServiceState, stopManagedService } from './postgres.mjs';

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

    for (const processInfo of [...managedProcesses].reverse()) {
      const stopped = await stopManagedProcess(processInfo);
      cleanupErrors += addStoppedProcessReport(report, processInfo, stopped);

      for (const port of processInfo.ports) {
        const released = await waitForPortReleased(port, '127.0.0.1', 5_000);

        if (released) {
          report.add(processInfo.name, 'OK', `Port ${port} released`);
        } else {
          cleanupErrors += 1;
          report.add(processInfo.name, 'ERROR', `Port ${port} is still busy`);
        }
      }
    }

    for (const service of [...managedServices].reverse()) {
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
    }

    return { cleanupErrors };
  }

  return function cleanupOnce() {
    cleanupPromise ??= restoreInitialState();
    return cleanupPromise;
  };
}
