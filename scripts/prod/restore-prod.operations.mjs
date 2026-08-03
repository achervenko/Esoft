import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { runCommand } from '../infrastructure/commands/run-command.mjs';
import { loadProductionRestoreConfig } from './restore-prod.config.mjs';
import {
  parseRestoreArguments,
  validateRestoreArtifacts,
} from './restore-prod.filesystem.mjs';
import { readRestoreManifest } from './restore-prod.manifest.mjs';
import {
  checkPgRestoreAvailable,
  checkProductionPostgres,
  restorePostgresDatabase,
} from './restore-prod.postgres.mjs';
import {
  checkStorageBucket,
  replaceStorageBucket,
  verifyRestoredStorage,
} from './restore-prod.storage.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

export const defaultProjectRoot = resolve(__dirname, '../..');

export function createDefaultProductionRestoreOperations() {
  return {
    parseRestoreArguments,
    loadProductionConfig: loadProductionRestoreConfig,
    readRestoreManifest,
    validateRestoreArtifacts,
    checkPgRestoreAvailable,
    checkProductionPostgres,
    checkStorageBucket,
    restorePostgresDatabase,
    replaceStorageBucket,
    verifyRestoredStorage,
  };
}

export function createDefaultProductionRestoreContext(options = {}) {
  return {
    argv: options.argv ?? process.argv.slice(2),
    projectRoot: options.projectRoot ?? defaultProjectRoot,
    runCommand: options.runCommand ?? runCommand,
    ...options.runtimeDependencies,
  };
}

export function loadRuntimeDependencies(projectRoot = defaultProjectRoot) {
  const backendRequire = createRequire(
    resolve(projectRoot, 'backend/package.json'),
  );
  const {
    DeleteObjectCommand,
    HeadBucketCommand,
    ListObjectsV2Command,
    PutObjectCommand,
    S3Client,
  } = backendRequire('@aws-sdk/client-s3');
  const { Client: PgClient } = backendRequire('pg');

  return {
    DeleteObjectCommand,
    HeadBucketCommand,
    ListObjectsV2Command,
    PgClient,
    PutObjectCommand,
    S3Client,
  };
}
