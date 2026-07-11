import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { StorageConfig } from './storage-config.type';

type EsoftConfigFile = {
  storage?: {
    accessKey?: string;
    bucket?: string;
    endpoint?: string;
    forcePathStyle?: boolean;
    region?: string;
    secretKey?: string;
  };
};

const DEFAULT_REGION = 'us-east-1';

export function loadStorageConfig(): StorageConfig {
  const config = readEsoftConfig();
  const storage = config.storage;

  if (!storage) {
    throw new Error('Storage config was not found in esoft.config.json.');
  }

  return {
    accessKey: requireConfigValue(storage.accessKey, 'storage.accessKey'),
    bucket: requireConfigValue(storage.bucket, 'storage.bucket'),
    endpoint: requireConfigValue(storage.endpoint, 'storage.endpoint'),
    forcePathStyle: storage.forcePathStyle ?? true,
    region: storage.region ?? DEFAULT_REGION,
    secretKey: requireConfigValue(storage.secretKey, 'storage.secretKey'),
  };
}

function readEsoftConfig(): EsoftConfigFile {
  const configPath = join(process.cwd(), '..', 'esoft.config.json');
  return JSON.parse(readFileSync(configPath, 'utf8')) as EsoftConfigFile;
}

function requireConfigValue(value: string | undefined, path: string) {
  if (!value) {
    throw new Error(`${path} is required in esoft.config.json.`);
  }

  return value;
}
