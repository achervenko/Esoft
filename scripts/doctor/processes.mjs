import { spawn } from 'node:child_process';
import { createServer } from 'node:net';

import { runCommand } from '../process/run-parallel.mjs';
import { displayName, formatError } from './utils.mjs';

export async function startManagedProcess(
  name,
  command,
  args,
  { isShuttingDown, managedProcesses, projectRoot, report, ...options },
) {
  try {
    const child = spawn(command, args, {
      cwd: options.cwd ?? projectRoot,
      detached: process.platform !== 'win32',
      env: options.env ?? process.env,
      shell: false,
      stdio: 'inherit',
      windowsHide: true,
      windowsVerbatimArguments: false,
    });

    const started = await new Promise((resolveStarted) => {
      child.once('spawn', () => {
        resolveStarted({ ok: true });
      });
      child.once('error', (error) => {
        resolveStarted({ message: formatError(error), ok: false });
      });
    });

    if (!started.ok) {
      return started;
    }

    const processInfo = {
      child,
      name,
      ports: options.ports ?? [],
    };

    if (isShuttingDown()) {
      await stopManagedProcess(processInfo);
      return {
        message: 'Shutdown started before process startup completed',
        ok: false,
      };
    }

    managedProcesses.push(processInfo);

    child.once('exit', (code, signal) => {
      if (isShuttingDown()) {
        return;
      }

      if (code !== null && code !== 0) {
        report.add(name, 'ERROR', `Exited with code ${code}`);
      } else if (signal) {
        report.add(name, 'ERROR', `Exited with signal ${signal}`);
      }
    });

    return { ok: true };
  } catch (error) {
    return { message: formatError(error), ok: false };
  }
}

export async function stopManagedProcess(processInfo) {
  const { child } = processInfo;

  if (!child.pid) {
    return true;
  }

  if (process.platform === 'win32') {
    await runCommand('taskkill.exe', ['/pid', String(child.pid), '/t', '/f'], {
      stdio: 'ignore',
    }).catch(() => undefined);

    await waitForExit(child, 3_000);
    return child.exitCode !== null || child.signalCode !== null;
  }

  try {
    process.kill(-child.pid, 'SIGTERM');
  } catch {
    return true;
  }

  await waitForExit(child, 3_000);

  if (child.exitCode === null && child.signalCode === null) {
    try {
      process.kill(-child.pid, 'SIGKILL');
    } catch {
      return true;
    }
  }

  await waitForExit(child, 2_000);
  return child.exitCode !== null || child.signalCode !== null;
}

export function waitForExit(child, timeoutMs) {
  if (child.exitCode !== null || child.signalCode !== null) {
    return Promise.resolve();
  }

  return new Promise((resolveWait) => {
    const timeout = setTimeout(resolveWait, timeoutMs);
    child.once('exit', () => {
      clearTimeout(timeout);
      resolveWait();
    });
  });
}

export function waitForPortReleased(port, host, timeoutMs) {
  const startedAt = Date.now();

  return new Promise((resolveReleased) => {
    const check = () => {
      const server = createServer();

      server.once('error', () => {
        if (Date.now() - startedAt >= timeoutMs) {
          resolveReleased(false);
          return;
        }

        setTimeout(check, 500);
      });

      server.listen(port, host, () => {
        server.close(() => resolveReleased(true));
      });
    };

    check();
  });
}

export function runCaptured(command, args, options = {}) {
  return new Promise((resolveRun) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      shell: false,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });
    let stdout = '';
    let stderr = '';
    const timeout = setTimeout(() => {
      child.kill('SIGKILL');
    }, options.timeoutMs ?? 15_000);

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.once('error', (error) => {
      clearTimeout(timeout);
      resolveRun({
        code: 1,
        stderr: formatError(error),
        stdout,
      });
    });
    child.once('exit', (code, signal) => {
      clearTimeout(timeout);
      resolveRun({
        code: code ?? (signal ? 1 : 0),
        signal,
        stderr: stderr.trim(),
        stdout: stdout.trim(),
      });
    });
  });
}

export function addStoppedProcessReport(report, processInfo, stopped) {
  if (stopped) {
    report.add(processInfo.name, 'STOPPED', `${displayName(processInfo.name)} stopped`);
    return 0;
  }

  report.add(processInfo.name, 'ERROR', `${displayName(processInfo.name)} cleanup failed`);
  return 1;
}
