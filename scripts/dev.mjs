import { createServer } from 'node:net';
import { mkdir } from 'node:fs/promises';

import {
  npmArgs,
  npmCommandName,
  npmScriptArgs,
  runCommand,
  runParallel,
} from './process/run-parallel.mjs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const configCore = require('./config/config-core.cjs');

const npm = npmCommandName();

const validation = await runCommand(npm, npmArgs(['run', 'config:validate']));

if (validation.code !== 0) {
  process.exit(validation.code ?? 1);
}

console.log('[project] Configuration validated');

const { config } = configCore.loadConfig();
const portsAvailable = await checkPortsAvailable([
  {
    host: config.backend.host,
    name: 'backend',
    port: config.backend.port,
  },
  {
    host: config.frontend.host,
    name: 'frontend',
    port: config.frontend.port,
  },
  {
    host: config.minio.host,
    name: 'minio',
    port: config.minio.port,
  },
  {
    host: config.minio.host,
    name: 'minio console',
    port: config.minio.consolePort,
  },
]);

if (!portsAvailable) {
  process.exit(1);
}

try {
  await mkdir(config.minio.dataDir, { recursive: true });
} catch (error) {
  console.error(
    `[project] Failed to prepare MinIO data directory ${config.minio.dataDir}: ${
      error instanceof Error ? error.message : String(error)
    }`,
  );
  process.exit(1);
}

runParallel([
  {
    args: [
      'server',
      config.minio.dataDir,
      '--address',
      `${config.minio.host}:${config.minio.port}`,
      '--console-address',
      `${config.minio.host}:${config.minio.consolePort}`,
    ],
    command: config.minio.executable,
    env: {
      ...process.env,
      MINIO_ROOT_PASSWORD: config.minio.rootPassword,
      MINIO_ROOT_USER: config.minio.rootUser,
    },
    name: 'minio',
  },
  {
    args: npmScriptArgs('start:dev', 'backend'),
    command: npm,
    name: 'backend',
  },
  {
    args: npmScriptArgs('dev', 'frontend'),
    command: npm,
    name: 'frontend',
  },
]);

async function checkPortsAvailable(ports) {
  const results = await Promise.all(ports.map(checkPortAvailable));
  const blocked = results.filter((result) => !result.available);

  for (const result of blocked) {
    console.error(
      `[project] Port ${result.port} for ${result.name} is not available on ${result.host}: ${result.message}`,
    );
  }

  return blocked.length === 0;
}

function checkPortAvailable({ host, name, port }) {
  return new Promise((resolve) => {
    const server = createServer();

    server.once('error', (error) => {
      resolve({
        available: false,
        host,
        message: error.message,
        name,
        port,
      });
    });

    server.listen(port, host, () => {
      server.close(() => {
        resolve({
          available: true,
          host,
          message: null,
          name,
          port,
        });
      });
    });
  });
}
