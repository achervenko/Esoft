import { waitForClose } from './process-registration.mjs';
import { stopPosixProcessGroup } from './process-termination.posix.mjs';
import { stopWindowsProcessTree } from './process-termination.windows.mjs';

export async function stopRegisteredProcess(resource, {
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
    return stopWindowsProcessTree(resource, {
      processKillGraceMs,
      runCommand,
    });
  }

  return stopPosixProcessGroup(resource, {
    killProcess,
    processKillGraceMs,
    processTermGraceMs,
  });
}
