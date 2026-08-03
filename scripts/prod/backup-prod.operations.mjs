import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { runCommand } from '../infrastructure/commands/run-command.mjs';
import { loadProductionBackupConfig } from './backup-prod.config.mjs';
import {
  cleanupIncompleteBackup,
  createBackupWorkspace,
  finalizeBackup,
  verifyBackupArtifacts,
} from './backup-prod.filesystem.mjs';
import {
  loadAppVersion,
  writeBackupManifest,
} from './backup-prod.manifest.mjs';
import {
  backupPostgresDatabase,
  checkPgDumpAvailable,
  verifyDatabaseDump,
} from './backup-prod.postgres.mjs';
import {
  backupStorageBucket,
  checkStorageBucket,
} from './backup-prod.storage.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

export const defaultProjectRoot = resolve(__dirname, '../..');

export function createDefaultProductionBackupOperations() {
  return {
    loadProductionConfig: loadProductionBackupConfig,
    checkPgDumpAvailable,
    createBackupWorkspace,
    backupPostgresDatabase,
    verifyDatabaseDump,
    checkStorageBucket,
    backupStorageBucket,
    writeBackupManifest,
    verifyBackupArtifacts,
    finalizeBackup,
    cleanupIncompleteBackup,
    loadAppVersion,
  };
}

export function createDefaultProductionBackupContext(options = {}) {
  return {
    clock: options.clock ?? (() => new Date()),
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
    GetObjectCommand,
    HeadBucketCommand,
    ListObjectsV2Command,
    S3Client,
  } = backendRequire('@aws-sdk/client-s3');

  return {
    GetObjectCommand,
    HeadBucketCommand,
    ListObjectsV2Command,
    S3Client,
  };
}
