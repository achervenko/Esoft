import { spawn } from 'node:child_process';

export {
  npmArgs,
  npmCommandName,
  npmScriptArgs,
} from '../infrastructure/commands/npm-command.mjs';

export async function runCommand(command, args = [], options = {}) {
  const spawnConfig = createSpawnConfig(command, args);
  let child;

  try {
    child = spawn(spawnConfig.command, spawnConfig.args, {
      cwd: options.cwd,
      detached: options.detached ?? false,
      env: options.env ?? process.env,
      shell: false,
      stdio: options.stdio ?? 'inherit',
      windowsHide: true,
      windowsVerbatimArguments: spawnConfig.windowsVerbatimArguments,
    });
  } catch (error) {
    return Promise.reject(error);
  }

  return new Promise((resolve, reject) => {
    const handleError = (error) => {
      child.removeListener('exit', handleExit);
      reject(error);
    };

    const handleExit = (code, signal) => {
      child.removeListener('error', handleError);
      resolve({ code, signal });
    };

    child.once('error', handleError);
    child.once('exit', handleExit);
  });
}

export function runParallel(commands) {
  if (!Array.isArray(commands) || commands.length === 0) {
    throw new Error('At least one command is required');
  }

  const children = [];
  let isShuttingDown = false;

  const shutdown = async (exitCode) => {
    if (isShuttingDown) {
      return;
    }

    isShuttingDown = true;
    const cleanupResults = await Promise.allSettled(
      children.map((child) => stopChildProcess(child)),
    );
    const cleanupFailed = cleanupResults.some(
      (result) => result.status === 'rejected',
    );

    process.exit(exitCode === 0 && cleanupFailed ? 1 : exitCode);
  };

  for (const command of commands) {
    console.log(`[${command.name}] Starting...`);

    let child;

    try {
      const spawnConfig = createSpawnConfig(command.command, command.args);

      child = spawn(spawnConfig.command, spawnConfig.args, {
        cwd: command.cwd,
        detached: process.platform !== 'win32',
        env: command.env ?? process.env,
        shell: false,
        stdio: 'inherit',
        windowsHide: true,
        windowsVerbatimArguments: spawnConfig.windowsVerbatimArguments,
      });
    } catch (error) {
      console.error(`[${command.name}] Failed to start: ${formatError(error)}`);
      void shutdown(1);
      break;
    }

    children.push(child);

    child.once('error', (error) => {
      console.error(`[${command.name}] Failed to start: ${error.message}`);
      void shutdown(1);
    });

    child.once('exit', (code, signal) => {
      if (isShuttingDown) {
        return;
      }

      const exitCode = getExitCode(code, signal);

      if (exitCode === 0) {
        console.log(`[${command.name}] Exited.`);
        void shutdown(0);
        return;
      }

      console.error(`[${command.name}] Exited with code ${exitCode}.`);
      void shutdown(exitCode);
    });
  }

  process.once('SIGINT', () => {
    void shutdown(130);
  });

  process.once('SIGTERM', () => {
    void shutdown(143);
  });
}

function createSpawnConfig(command, args = []) {
  if (
    process.platform === 'win32' &&
    (command.endsWith('.cmd') || command.endsWith('.bat'))
  ) {
    return {
      args: ['/d', '/s', '/c', `"${quoteCmdCommand([command, ...args])}"`],
      command: process.env.ComSpec ?? 'cmd.exe',
      windowsVerbatimArguments: true,
    };
  }

  return { args, command };
}

function getExitCode(code, signal) {
  if (signal === 'SIGINT' || code === 130) {
    return 130;
  }

  if (signal === 'SIGTERM' || code === 143) {
    return 143;
  }

  return code ?? 1;
}

function quoteCmdCommand(parts) {
  return parts.map(quoteCmdArgument).join(' ');
}

function quoteCmdArgument(value) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

async function stopChildProcess(child) {
  if (!child.pid) {
    return;
  }

  if (process.platform === 'win32') {
    const result = await runCommand('taskkill.exe', [
      '/pid',
      String(child.pid),
      '/t',
      '/f',
    ], {
      stdio: 'ignore',
    });

    await waitForExit(child, 3_000);

    const exited = child.exitCode !== null || child.signalCode !== null;

    if (result.code !== 0 && !exited) {
      throw new Error(`taskkill failed with code ${result.code ?? 'unknown'}`);
    }

    if (!exited) {
      throw new Error(`Process ${child.pid} did not exit after taskkill`);
    }

    return;
  }

  if (!isProcessGroupRunning(child.pid)) {
    return;
  }

  try {
    process.kill(-child.pid, 'SIGTERM');
  } catch (error) {
    if (isProcessMissingError(error)) {
      return;
    }

    throw error;
  }

  await waitForExit(child, 3_000);
  await waitForProcessGroupExit(child.pid, 3_000);

  if (isProcessGroupRunning(child.pid)) {
    try {
      process.kill(-child.pid, 'SIGKILL');
    } catch (error) {
      if (!isProcessMissingError(error)) {
        throw error;
      }
    }

    await waitForExit(child, 2_000);
    await waitForProcessGroupExit(child.pid, 2_000);

    if (isProcessGroupRunning(child.pid)) {
      throw new Error(`Process group ${child.pid} did not stop after SIGKILL`);
    }
  }
}

function isProcessGroupRunning(pid) {
  try {
    process.kill(-pid, 0);
    return true;
  } catch (error) {
    if (isProcessMissingError(error)) {
      return false;
    }

    throw error;
  }
}

async function waitForProcessGroupExit(pid, timeoutMs, intervalMs = 100) {
  if (!Number.isFinite(timeoutMs) || timeoutMs < 0) {
    throw new TypeError('timeoutMs must be a non-negative finite number');
  }

  if (!Number.isFinite(intervalMs) || intervalMs <= 0) {
    throw new TypeError('intervalMs must be a positive finite number');
  }

  const startedAt = Date.now();

  while (true) {
    if (!isProcessGroupRunning(pid)) {
      return true;
    }

    const remainingMs = timeoutMs - (Date.now() - startedAt);

    if (remainingMs <= 0) {
      return false;
    }

    await delay(Math.min(intervalMs, remainingMs));
  }
}

function waitForExit(child, timeoutMs) {
  if (!Number.isFinite(timeoutMs) || timeoutMs < 0) {
    throw new TypeError('timeoutMs must be a non-negative finite number');
  }

  if (child.exitCode !== null || child.signalCode !== null) {
    return Promise.resolve();
  }

  return new Promise((resolveWait) => {
    const handleExit = () => {
      clearTimeout(timeout);
      resolveWait();
    };

    const timeout = setTimeout(() => {
      child.removeListener('exit', handleExit);
      resolveWait();
    }, timeoutMs);

    child.once('exit', handleExit);
  });
}

function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function isProcessMissingError(error) {
  return (
    error !== null &&
    typeof error === 'object' &&
    'code' in error &&
    error.code === 'ESRCH'
  );
}

function formatError(error) {
  return error instanceof Error ? error.message : String(error);
}
