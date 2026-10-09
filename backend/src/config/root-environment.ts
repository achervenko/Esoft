import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';

const requireConfigModule = createRequire(__filename);

export type EsoftConfig = {
  auth: {
    secret: string;
    url: string;
  };
  backend: {
    host: string;
    port: number;
    url: string;
  };
  database: {
    url: string;
  };
  frontend: {
    apiUrl?: string;
    host?: string;
    port?: number;
    url: string;
  };
  minio: {
    accessKey: string;
    bucket: string;
    consolePort?: number;
    consoleUrl?: string;
    dataDir?: string;
    endpoint: string;
    executable?: string;
    host: string;
    port: number;
    region: string;
    rootPassword?: string;
    rootUser?: string;
    secretKey: string;
    useSsl: boolean;
  };
  nodeEnv: string;
};

type LoadedConfig = {
  config: EsoftConfig;
  env: Record<string, string | undefined>;
  envPath: string;
  projectRoot: string;
};

type ConfigCore = {
  loadConfig(options?: {
    profile?: 'backend' | 'database';
    applyToProcessEnv?: boolean;
    overrideProcessEnv?: boolean;
  }): LoadedConfig;
};

let configCore: ConfigCore | null = null;

export function loadRootConfig(): EsoftConfig {
  return loadRootEnvironment().config;
}

export function loadRootDatabaseUrl(): string {
  return getConfigCore().loadConfig({
    profile: 'database',
    applyToProcessEnv: true,
    overrideProcessEnv: true,
  }).config.database.url;
}

export function loadRootEnvironment(): LoadedConfig {
  const core = getConfigCore();
  const loadedConfig = core.loadConfig({
    profile: 'backend',
    applyToProcessEnv: true,
    overrideProcessEnv: true,
  });

  return loadedConfig;
}

function getConfigCore(): ConfigCore {
  if (configCore) {
    return configCore;
  }

  const configCorePath = resolveConfigCorePath();
  configCore = requireConfigModule(configCorePath) as ConfigCore;

  return configCore;
}

function resolveConfigCorePath() {
  const candidates = [
    resolve(__dirname, '../../../scripts/config/config-core.cjs'),
    resolve(__dirname, '../../../../scripts/config/config-core.cjs'),
    resolve(process.cwd(), 'scripts/config/config-core.cjs'),
    resolve(process.cwd(), '../scripts/config/config-core.cjs'),
  ];

  const configCorePath = candidates.find((candidate) => existsSync(candidate));

  if (!configCorePath) {
    throw new Error(
      'Esoft configuration core was not found at scripts/config/config-core.cjs.',
    );
  }

  return configCorePath;
}
