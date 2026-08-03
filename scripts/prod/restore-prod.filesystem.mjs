import { lstat, readdir } from 'node:fs/promises';
import { isAbsolute, relative, resolve, sep } from 'node:path';

import { failure, success } from '../infrastructure/result.mjs';
import { formatError } from '../infrastructure/security/redaction.mjs';

const defaultRestoreFilesystem = {
  lstat,
  readdir,
};

export function parseRestoreArguments(argv = process.argv.slice(2)) {
  let backupPath;
  let confirm = false;

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];

    if (argument === '--confirm') {
      confirm = true;
      continue;
    }

    if (argument === '--backup') {
      backupPath = argv[index + 1];
      index += 1;
      continue;
    }

    if (argument.startsWith('--backup=')) {
      backupPath = argument.slice('--backup='.length);
    }
  }

  if (!confirm) {
    return failure(
      'RESTORE_CONFIRMATION_REQUIRED',
      'Restore requires --confirm',
    );
  }

  if (typeof backupPath !== 'string' || backupPath.trim() === '') {
    return failure('RESTORE_BACKUP_REQUIRED', 'Restore requires --backup');
  }

  return success('RESTORE_ARGUMENTS_OK', 'Restore arguments parsed', {
    backupPath: resolve(backupPath),
  });
}

export async function validateRestoreArtifacts({
  backupPath,
  expectedObjectCount,
  expectedTotalBytes,
  filesystem = defaultRestoreFilesystem,
}) {
  const resolvedBackupPath = resolve(backupPath);
  const dumpPath = resolve(resolvedBackupPath, 'database.dump');
  const manifestPath = resolve(resolvedBackupPath, 'backup.json');
  const storagePath = resolve(resolvedBackupPath, 'storage');

  if (
    !isPathInside(resolvedBackupPath, dumpPath) ||
    !isPathInside(resolvedBackupPath, manifestPath) ||
    !isPathInside(resolvedBackupPath, storagePath)
  ) {
    return failure('RESTORE_ARTIFACTS_INVALID', 'Restore artifact paths are unsafe');
  }

  try {
    const backupStat = await filesystem.lstat(resolvedBackupPath);

    if (backupStat.isSymbolicLink()) {
      return failure(
        'RESTORE_BACKUP_UNSAFE',
        'Backup path must not be a symbolic link',
        {
          backupPath: resolvedBackupPath,
        },
      );
    }

    if (!backupStat.isDirectory()) {
      return failure('RESTORE_BACKUP_MISSING', 'Backup path is not a directory', {
        backupPath: resolvedBackupPath,
      });
    }

    const [dumpStat, manifestStat, storageStat] = await Promise.all([
      filesystem.lstat(dumpPath),
      filesystem.lstat(manifestPath),
      filesystem.lstat(storagePath),
    ]);

    if (manifestStat.isSymbolicLink()) {
      return unsafeArtifact('backup.json must not be a symbolic link', manifestPath);
    }

    if (dumpStat.isSymbolicLink()) {
      return unsafeArtifact('database.dump must not be a symbolic link', dumpPath);
    }

    if (storageStat.isSymbolicLink()) {
      return unsafeArtifact('storage must not be a symbolic link', storagePath);
    }

    if (!manifestStat.isFile() || manifestStat.size <= 0) {
      return failure('RESTORE_MANIFEST_INVALID', 'backup.json is invalid', {
        manifestPath,
      });
    }

    if (!dumpStat.isFile() || dumpStat.size <= 0) {
      return failure('RESTORE_DUMP_INVALID', 'database.dump is invalid', {
        dumpPath,
      });
    }

    if (!storageStat.isDirectory()) {
      return failure('RESTORE_STORAGE_INVALID', 'storage is not a directory', {
        storagePath,
      });
    }

    const storageSummary = await summarizeRestoreStorage({
      currentPath: storagePath,
      filesystem,
      storagePath,
    });

    if (!storageSummary.ok) {
      return storageSummary;
    }

    if (
      Number.isInteger(expectedObjectCount) &&
      storageSummary.details.objectCount !== expectedObjectCount
    ) {
      return failure(
        'RESTORE_STORAGE_SUMMARY_MISMATCH',
        'Backup storage object count does not match manifest',
        {
          actualObjectCount: storageSummary.details.objectCount,
          expectedObjectCount,
        },
      );
    }

    if (
      Number.isInteger(expectedTotalBytes) &&
      storageSummary.details.totalBytes !== expectedTotalBytes
    ) {
      return failure(
        'RESTORE_STORAGE_SUMMARY_MISMATCH',
        'Backup storage total size does not match manifest',
        {
          actualTotalBytes: storageSummary.details.totalBytes,
          expectedTotalBytes,
        },
      );
    }

    return success('RESTORE_ARTIFACTS_OK', 'Restore artifacts are valid', {
      backupPath: resolvedBackupPath,
      dumpPath,
      manifestPath,
      storagePath,
      storageObjectCount: storageSummary.details.objectCount,
      storageTotalBytes: storageSummary.details.totalBytes,
    });
  } catch (error) {
    return failure('RESTORE_ARTIFACTS_INVALID', 'Restore artifacts are invalid', {
      backupPath: resolvedBackupPath,
      error: formatError(error),
    });
  }
}

async function summarizeRestoreStorage({
  currentPath,
  filesystem,
  storagePath,
}) {
  const entries = await filesystem.readdir(currentPath, { withFileTypes: true });
  let objectCount = 0;
  let totalBytes = 0;

  for (const entry of entries) {
    const entryPath = resolve(currentPath, entry.name);

    if (!isPathInside(storagePath, entryPath)) {
      return unsafeStorageEntry(entryPath);
    }

    const entryStat = await filesystem.lstat(entryPath);

    if (entryStat.isSymbolicLink()) {
      return unsafeStorageEntry(entryPath);
    }

    if (entryStat.isDirectory()) {
      const summary = await summarizeRestoreStorage({
        currentPath: entryPath,
        filesystem,
        storagePath,
      });

      if (!summary.ok) {
        return summary;
      }

      objectCount += summary.details.objectCount;
      totalBytes += summary.details.totalBytes;
    } else if (!entryStat.isFile()) {
      return unsafeStorageEntry(entryPath);
    } else {
      objectCount += 1;
      totalBytes += entryStat.size;
    }
  }

  return success('RESTORE_STORAGE_SUMMARY_OK', 'Backup storage summary is valid', {
    objectCount,
    totalBytes,
  });
}

function unsafeStorageEntry(path) {
  return failure(
    'RESTORE_STORAGE_UNSAFE',
    'Backup storage contains an unsafe filesystem entry',
    {
      path,
    },
  );
}

function unsafeArtifact(message, path) {
  return failure('RESTORE_ARTIFACTS_UNSAFE', message, {
    path,
  });
}

function isPathInside(root, path) {
  const relativePath = relative(root, path);

  return (
    relativePath === '' ||
    (relativePath !== '..' &&
      !relativePath.startsWith(`..${sep}`) &&
      !isAbsolute(relativePath))
  );
}
