import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';

const npmCliPath = resolveNpmCliPath();
const npmSpawn = createNpmSpawnConfig(npmCliPath);

export function npmScriptArgs(script, workspace, extraArgs = []) {
  return npmArgs(['run', script, '--workspace', workspace, ...extraArgs]);
}

export function npmArgs(args) {
  return [...npmSpawn.argsPrefix, ...args];
}

export function npmCommandName() {
  return npmSpawn.command;
}

export async function runCommand(command, args, options = {}) {
  const spawnConfig = createSpawnConfig(command, args);
  const child = spawn(spawnConfig.command, spawnConfig.args, {
    cwd: options.cwd,
    detached: options.detached ?? false,
    shell: false,
    stdio: options.stdio ?? 'inherit',
    windowsHide: true,
    windowsVerbatimArguments: spawnConfig.windowsVerbatimArguments,
  });

  return new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('exit', (code, signal) => {
      resolve({ code, signal });
    });
  });
}

export function runParallel(commands) {
  const children = [];
  let isShuttingDown = false;

  const shutdown = async (exitCode) => {
    if (isShuttingDown) {
      return;
    }

    isShuttingDown = true;
    await Promise.allSettled(children.map((child) => stopChildProcess(child)));
    process.exit(exitCode);
  };

  for (const command of commands) {
    console.log(`[${command.name}] Starting...`);

    const spawnConfig = createSpawnConfig(command.command, command.args);
    const child = spawn(spawnConfig.command, spawnConfig.args, {
      cwd: command.cwd,
      detached: process.platform !== 'win32',
      env: command.env ?? process.env,
      shell: false,
      stdio: 'inherit',
      windowsHide: true,
      windowsVerbatimArguments: spawnConfig.windowsVerbatimArguments,
    });

    children.push(child);

    child.once('error', (error) => {
      console.error(`[${command.name}] Failed to start: ${error.message}`);
      void shutdown(1);
    });

    child.once('exit', (code, signal) => {
      if (isShuttingDown) {
        return;
      }

      const isInterrupted =
        signal === 'SIGINT' ||
        signal === 'SIGTERM' ||
        code === 130 ||
        code === 143;
      const exitCode = isInterrupted ? 0 : (code ?? 1);

      if (isInterrupted) {
        void shutdown(0);
        return;
      }

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
    void shutdown(0);
  });

  process.once('SIGTERM', () => {
    void shutdown(0);
  });
}

function createSpawnConfig(command, args) {
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

function quoteCmdCommand(parts) {
  return parts.map(quoteCmdArgument).join(' ');
}

function quoteCmdArgument(value) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

function resolveNpmCliPath() {
  if (process.platform !== 'win32') {
    return null;
  }

  const candidates = [
    process.env.npm_execpath,
    join(dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js'),
  ];

  return candidates.find((candidate) => candidate && existsSync(candidate)) ?? null;
}

function createNpmSpawnConfig(resolvedNpmCliPath) {
  if (process.platform !== 'win32') {
    return {
      argsPrefix: [],
      command: 'npm',
    };
  }

  if (resolvedNpmCliPath) {
    return {
      argsPrefix: [resolvedNpmCliPath],
      command: process.execPath,
    };
  }

  return {
    argsPrefix: [],
    command: 'npm.cmd',
  };
}

async function stopChildProcess(child) {
  if (process.platform === 'win32') {
    await runCommand('taskkill.exe', [
      '/pid',
      String(child.pid),
      '/t',
      '/f',
    ], {
      stdio: 'ignore',
    }).catch(() => undefined);

    return;
  }

  if (child.exitCode !== null || child.signalCode !== null) {
    return;
  }

  try {
    process.kill(-child.pid, 'SIGTERM');
  } catch {
    return;
  }

  await waitForExit(child, 3_000);

  if (child.exitCode === null && child.signalCode === null) {
    try {
      process.kill(-child.pid, 'SIGKILL');
    } catch {
      // Process already stopped.
    }
  }
}

function waitForExit(child, timeoutMs) {
  if (child.exitCode !== null || child.signalCode !== null) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    const timeout = setTimeout(resolve, timeoutMs);
    child.once('exit', () => {
      clearTimeout(timeout);
      resolve();
    });
  });
}
