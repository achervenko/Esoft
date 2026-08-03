import { waitForClose } from './process-registration.mjs';

export async function stopWindowsProcessTree(resource, {
  processKillGraceMs,
  runCommand,
}) {
  const { child } = resource;
  const termination = await runCommand('taskkill.exe', [
    '/pid',
    String(child.pid),
    '/t',
    '/f',
  ]);

  if (!termination.ok) {
    return {
      error: termination.error,
      message: `Unable to stop process tree: ${termination.message}`,
      ok: false,
    };
  }

  if (await waitForClose(resource.closePromise, processKillGraceMs)) {
    return { ok: true };
  }

  return {
    error: new Error('Process did not close after taskkill'),
    message: 'Process did not close after taskkill',
    ok: false,
  };
}
