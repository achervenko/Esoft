import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

import { createBackupChecksums } from './backup-integrity.mjs';
import { failure, success } from '../infrastructure/result.mjs';
import { formatError } from '../infrastructure/security/redaction.mjs';

export async function writeBackupManifest({
  appVersion,
  config,
  createdAt,
  manifestPath,
  storageSummary,
}) {
  try {
    const checksums = await createBackupChecksums(dirname(manifestPath));
    const totalBytes = checksums.objects.reduce((total, entry) => total + entry.sizeBytes, 0);
    if (checksums.objects.length !== storageSummary.objectCount || totalBytes !== storageSummary.totalBytes) {
      return failure('BACKUP_MANIFEST_FAILED', 'Backup files do not match the storage copy summary');
    }
    const manifest = {
      formatVersion: 2,
      createdAt: createdAt.toISOString(),
      appVersion,
      database: { file: 'database.dump', ...checksums.database },
      storage: {
        bucket: config.minio.bucket,
        directory: 'storage',
        objectCount: storageSummary.objectCount,
        totalBytes: storageSummary.totalBytes,
        objects: checksums.objects,
      },
    };
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
