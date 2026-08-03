import {
  mkdir,
  readFile,
  rename,
  rm,
  stat,
} from 'node:fs/promises';
import { isAbsolute, relative, resolve, sep } from 'node:path';

import { failure, success } from '../infrastructure/result.mjs';
import { formatError } from '../infrastructure/security/redaction.mjs';

const defaultWorkspaceFilesystem = {
  mkdir,
  rm,
};

export async function createBackupWorkspace({
  backupRoot,
  clock,
  filesystem = defaultWorkspaceFilesystem,
}) {
  const resolvedBackupRoot = resolve(backupRoot);
  const timestamp = formatBackupTimestamp(clock());
  const incompletePath = resolve(resolvedBackupRoot, `.${timestamp}.incomplete`);
  const finalPath = resolve(resolvedBackupRoot, timestamp);
  let incompleteCreated = false;

  if (
    !isPathInside(resolvedBackupRoot, incompletePath) ||
    !isPathInside(resolvedBackupRoot, finalPath)
  ) {
    return failure('BACKUP_DIRECTORY_FAILED', 'Backup path is unsafe', {
      backupRoot: resolvedBackupRoot,
    });
  }

  try {
    await filesystem.mkdir(resolvedBackupRoot, { recursive: true });
    await filesystem.mkdir(incompletePath, { recursive: false });
    incompleteCreated = true;
    await filesystem.mkdir(resolve(incompletePath, 'storage'), {
      recursive: true,
    });

    return success('BACKUP_DIRECTORY_READY', 'Backup directory is ready', {
      finalPath,
      incompletePath,
      timestamp,
    });
  } catch (error) {
    if (incompleteCreated) {
      try {
        await filesystem.rm(incompletePath, {
          force: true,
          recursive: true,
        });
      } catch {
        // The directory remains visibly incomplete and is not a valid backup.
      }
    }

    return failure('BACKUP_DIRECTORY_FAILED', 'Unable to create backup directory', {
      backupRoot: resolvedBackupRoot,
      error: formatError(error),
      incompletePath,
    });
  }
}

export async function verifyBackupArtifacts({
  backupPath,
  dumpPath,
  manifestPath,
  storagePath,
}) {
  try {
    const [backupStat, dumpStat, storageStat, manifestStat] = await Promise.all([
      stat(backupPath),
      stat(dumpPath),
      stat(storagePath),
      stat(manifestPath),
    ]);

    if (!backupStat.isDirectory()) {
      return failure('BACKUP_ARTIFACTS_INVALID', 'Backup path is not a directory');
    }

    if (!dumpStat.isFile() || dumpStat.size <= 0) {
      return failure('BACKUP_ARTIFACTS_INVALID', 'database.dump is invalid');
    }

    if (!storageStat.isDirectory()) {
      return failure('BACKUP_ARTIFACTS_INVALID', 'storage is not a directory');
    }

    if (!manifestStat.isFile() || manifestStat.size <= 0) {
      return failure('BACKUP_MANIFEST_FAILED', 'backup.json is invalid');
    }

    JSON.parse(await readFile(manifestPath, 'utf8'));

    return success('BACKUP_ARTIFACTS_VERIFIED', 'Backup artifacts are valid');
  } catch (error) {
    return failure('BACKUP_ARTIFACTS_INVALID', 'Backup artifacts are invalid', {
      error: formatError(error),
    });
  }
}

export async function finalizeBackup({ finalPath, incompletePath }) {
  try {
    await rename(incompletePath, finalPath);

    return success('BACKUP_FINALIZED', 'Backup finalized', {
      backupPath: finalPath,
    });
  } catch (error) {
    return failure('BACKUP_FINALIZE_FAILED', 'Unable to finalize backup', {
      error: formatError(error),
      finalPath,
      incompletePath,
    });
  }
}

export async function cleanupIncompleteBackup({ incompletePath }) {
  if (!incompletePath) {
    return success('BACKUP_CLEANUP_SKIPPED', 'No incomplete backup to clean up');
  }

  try {
    await rm(incompletePath, {
      force: true,
      recursive: true,
    });

    return success('BACKUP_CLEANUP_OK', 'Incomplete backup cleaned up');
  } catch (error) {
    return failure('BACKUP_CLEANUP_FAILED', 'Unable to clean incomplete backup', {
      error: formatError(error),
      incompletePath,
    });
  }
}

export function formatBackupTimestamp(date) {
  return date
    .toISOString()
    .replace(/\.\d{3}Z$/, '')
    .replaceAll(':', '-')
    .replace('T', '_');
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
