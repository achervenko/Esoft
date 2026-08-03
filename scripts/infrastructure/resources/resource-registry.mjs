import { runTerminationCommand } from '../commands/termination-command.mjs';
import { formatError } from '../security/redaction.mjs';
import { createRegisteredProcess } from './process-registration.mjs';
import { stopRegisteredProcess } from './process-termination.mjs';

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
