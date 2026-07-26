import { spawn } from 'node:child_process';

import { formatError } from '../security/redaction.mjs';
import { createSpawnConfig } from './spawn-config.mjs';
import { terminateTimedOutChild } from './terminate-process.mjs';

export function runCommand(command, args = [], options = {}) {
  const timeoutMs = options.timeoutMs ?? 15_000;

  if (!Number.isFinite(timeoutMs) || timeoutMs < 0) {
    throw new TypeError('timeoutMs must be a non-negative finite number');
  }

  return new Promise((resolveRun) => {
    let closeResolve;
    const closePromise = new Promise((resolveClose) => {
      closeResolve = resolveClose;
    });
    let settled = false;
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    let child = null;
    let timeout = null;

    const settle = (result) => {
      if (settled) {
        return;
      }

      settled = true;
      clearTimeout(timeout);
      resolveRun(result);
    };

    const handleTimeout = async () => {
      timedOut = true;

      if (!child) {
        settle({
          code: null,
          ok: false,
          signal: null,
          stderr: stderr.trim(),
          stdout: stdout.trim(),
          timedOut: true,
        });
        return;
      }

      const termination = await terminateTimedOutChild(child, closePromise);

      if (termination.ok) {
        return;
      }

      settle({
        code: null,
        error: termination.error,
        ok: false,
        signal: null,
        stderr: mergeOutput(stderr.trim(), termination.message),
        stdout: stdout.trim(),
        terminationFailed: true,
        timedOut: true,
      });
    };

    let spawnConfig;

    try {
      spawnConfig = createSpawnConfig(command, args);
    } catch (error) {
      settle({
        code: null,
        error,
        ok: false,
        signal: null,
        stderr: formatError(error),
        stdout: '',
        timedOut: false,
      });
      return;
    }

    timeout = setTimeout(() => {
      void handleTimeout().catch((error) => {
        settle({
          code: null,
          error,
          ok: false,
          signal: null,
          stderr: mergeOutput(stderr.trim(), formatError(error)),
          stdout: stdout.trim(),
          terminationFailed: true,
          timedOut: true,
        });
      });
    }, timeoutMs);

    try {
      child = spawn(spawnConfig.command, spawnConfig.args, {
        cwd: options.cwd,
        detached: process.platform !== 'win32',
        env: options.env ?? process.env,
        shell: false,
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
        windowsVerbatimArguments: spawnConfig.windowsVerbatimArguments,
      });
    } catch (error) {
      settle({
        code: null,
        error,
        ok: false,
        signal: null,
        stderr: formatError(error),
        stdout: '',
        timedOut: false,
      });
      return;
    }

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.once('error', (error) => {
      settle({
        code: null,
        error,
        ok: false,
        signal: null,
        stderr: formatError(error),
        stdout: stdout.trim(),
        timedOut,
      });
    });
    child.once('close', (code, signal) => {
      closeResolve({ code, signal });
      settle({
        code,
        ok: !timedOut && code === 0,
        signal,
        stderr: stderr.trim(),
        stdout: stdout.trim(),
        timedOut,
      });
    });
  });
}

function mergeOutput(...values) {
  return values.filter((value) => value !== '').join('\n');
}
