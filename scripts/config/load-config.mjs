import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const configCore = require('./config-core.cjs');

export const applyEnvironment = configCore.applyEnvironment;
export const loadConfig = configCore.loadConfig;
export const loadEnvironment = configCore.loadEnvironment;
export const parseEnvFile = configCore.parseEnvFile;

const isMainModule =
  process.argv[1] &&
  fileURLToPath(import.meta.url) === resolve(process.argv[1]);

if (isMainModule) {
  const { config, envPath } = loadConfig();
  console.log(`Loaded Esoft configuration from ${envPath}`);
  console.log(
    JSON.stringify(
      {
        backend: config.backend,
        frontend: config.frontend,
        minio: {
          bucket: config.minio.bucket,
          consoleUrl: config.minio.consoleUrl,
          endpoint: config.minio.endpoint,
        },
        nodeEnv: config.nodeEnv,
      },
      null,
      2,
    ),
  );
}
