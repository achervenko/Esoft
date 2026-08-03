import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { failure, success } from '../infrastructure/result.mjs';
import { formatError } from '../infrastructure/security/redaction.mjs';

export async function writeBackupManifest({
  appVersion,
  config,
  createdAt,
  manifestPath,
  storageSummary,
}) {
  const manifest = {
    formatVersion: 1,
    createdAt: createdAt.toISOString(),
    appVersion,
    database: {
      file: 'database.dump',
    },
    storage: {
      bucket: config.minio.bucket,
      directory: 'storage',
      objectCount: storageSummary.objectCount,
      totalBytes: storageSummary.totalBytes,
    },
  };

  try {
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

    return success('BACKUP_MANIFEST_OK', 'Backup manifest written', {
      file: 'backup.json',
      objectCount: manifest.storage.objectCount,
    });
  } catch (error) {
    return failure('BACKUP_MANIFEST_FAILED', 'Unable to write backup manifest', {
      error: formatError(error),
    });
  }
}

export async function loadAppVersion({ projectRoot }) {
  try {
    const packageJson = JSON.parse(
      await readFile(resolve(projectRoot, 'package.json'), 'utf8'),
    );

    const appVersion =
      typeof packageJson.version === 'string' ? packageJson.version.trim() : '';

    if (appVersion === '') {
      return failure('BACKUP_APP_VERSION_UNAVAILABLE', 'App version is missing');
    }

    return success('BACKUP_APP_VERSION_OK', 'App version loaded', {
      appVersion,
    });
  } catch (error) {
    return failure('BACKUP_APP_VERSION_UNAVAILABLE', 'Unable to load app version', {
      error: formatError(error),
    });
  }
}
