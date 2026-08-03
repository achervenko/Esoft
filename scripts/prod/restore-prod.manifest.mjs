import { lstat, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { failure, success } from '../infrastructure/result.mjs';
import { formatError } from '../infrastructure/security/redaction.mjs';

const defaultManifestFilesystem = {
  lstat,
  readFile,
};

export async function readRestoreManifest({
  backupPath,
  config,
  filesystem = defaultManifestFilesystem,
}) {
  const manifestPath = resolve(backupPath, 'backup.json');
  let manifest;

  try {
    const backupStat = await filesystem.lstat(backupPath);

    if (backupStat.isSymbolicLink()) {
      return failure(
        'RESTORE_BACKUP_UNSAFE',
        'Backup path must not be a symbolic link',
        {
          backupPath,
        },
      );
    }

    if (!backupStat.isDirectory()) {
      return failure('RESTORE_BACKUP_MISSING', 'Backup path is not a directory', {
        backupPath,
      });
    }
  } catch (error) {
    return failure('RESTORE_BACKUP_MISSING', 'Backup path is missing', {
      backupPath,
      error: formatError(error),
    });
  }

  try {
    const manifestStat = await filesystem.lstat(manifestPath);

    if (manifestStat.isSymbolicLink()) {
      return failure(
        'RESTORE_ARTIFACTS_UNSAFE',
        'backup.json must not be a symbolic link',
        {
          path: manifestPath,
        },
      );
    }

    if (!manifestStat.isFile() || manifestStat.size <= 0) {
      return failure('RESTORE_MANIFEST_INVALID', 'backup.json is invalid', {
        manifestPath,
      });
    }
  } catch (error) {
    return failure('RESTORE_MANIFEST_INVALID', 'Unable to read backup manifest', {
      error: formatError(error),
      manifestPath,
    });
  }

  try {
    manifest = JSON.parse(await filesystem.readFile(manifestPath, 'utf8'));
  } catch (error) {
    return failure('RESTORE_MANIFEST_INVALID', 'Unable to parse backup manifest', {
      error: formatError(error),
      manifestPath,
    });
  }

  const validation = validateRestoreManifest({ config, manifest });

  if (!validation.ok) {
    return validation;
  }

  return success('RESTORE_MANIFEST_OK', 'Backup manifest is valid', {
    manifest,
    manifestPath,
  });
}

function validateRestoreManifest({ config, manifest }) {
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
    return invalidManifest('Backup manifest must be an object');
  }

  if (manifest.formatVersion !== 1) {
    return invalidManifest('Backup manifest format is unsupported', {
      formatVersion: manifest.formatVersion,
    });
  }

  if (!isNonEmptyString(manifest.createdAt)) {
    return invalidManifest('Backup manifest createdAt is invalid');
  }

  if (!isNonEmptyString(manifest.appVersion)) {
    return invalidManifest('Backup manifest appVersion is invalid');
  }

  if (manifest.database?.file !== 'database.dump') {
    return invalidManifest('Backup manifest database file is invalid');
  }

  if (manifest.storage?.directory !== 'storage') {
    return invalidManifest('Backup manifest storage directory is invalid');
  }

  if (manifest.storage?.bucket !== config.minio.bucket) {
    return failure(
      'RESTORE_BUCKET_MISMATCH',
      'Backup bucket does not match production bucket',
      {
        backupBucket: manifest.storage?.bucket,
        productionBucket: config.minio.bucket,
      },
    );
  }

  if (!isNonNegativeInteger(manifest.storage?.objectCount)) {
    return invalidManifest('Backup manifest objectCount is invalid');
  }

  if (!isNonNegativeInteger(manifest.storage?.totalBytes)) {
    return invalidManifest('Backup manifest totalBytes is invalid');
  }

  return success('RESTORE_MANIFEST_VALID', 'Backup manifest is valid');
}

function invalidManifest(message, details = undefined) {
  return failure('RESTORE_MANIFEST_INVALID', message, details);
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim() !== '';
}

function isNonNegativeInteger(value) {
  return Number.isInteger(value) && value >= 0;
}
