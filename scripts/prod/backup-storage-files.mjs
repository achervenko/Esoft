import { readdir, lstat } from 'node:fs/promises';
import { relative, resolve, sep } from 'node:path';

import { failure, success } from '../infrastructure/result.mjs';
import { formatError } from '../infrastructure/security/redaction.mjs';

export async function collectBackupObjects(storagePath) {
  const objects = [];

  try {
    await collectBackupObjectsInto({
      objects,
      rootPath: storagePath,
      currentPath: storagePath,
    });

    return success('RESTORE_STORAGE_FILES_LISTED', 'Backup storage files listed', {
      objects,
    });
  } catch (error) {
    return failure('RESTORE_STORAGE_INVALID', 'Unable to list backup storage files', {
      error: formatError(error),
      storagePath,
    });
  }
}

async function collectBackupObjectsInto({ currentPath, objects, rootPath }) {
  const entries = await readdir(currentPath, { withFileTypes: true });

  for (const entry of entries) {
    const entryPath = resolve(currentPath, entry.name);
    const entryStat = await lstat(entryPath);

    if (entryStat.isSymbolicLink()) {
      throw new Error(`Symbolic link is not allowed: ${entryPath}`);
    }

    if (entryStat.isDirectory()) {
      await collectBackupObjectsInto({
        currentPath: entryPath,
        objects,
        rootPath,
      });
      continue;
    }

    if (!entryStat.isFile()) {
      throw new Error(`Unsupported backup storage entry: ${entryPath}`);
    }

    const objectKey = relative(rootPath, entryPath).split(sep).join('/');

    objects.push({
      key: objectKey,
      path: entryPath,
      size: entryStat.size,
    });
  }
}
