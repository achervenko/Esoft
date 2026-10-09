import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { lstat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { failure, success } from '../infrastructure/result.mjs';
import { formatError } from '../infrastructure/security/redaction.mjs';
import { collectBackupObjects } from './backup-storage-files.mjs';

async function checksumFile(path) {
  const info = await lstat(path);
  if (!info.isFile() || info.isSymbolicLink()) {
    throw new Error('Backup checksum target must be a regular file');
  }
  const hash = createHash('sha256');
  let sizeBytes = 0;
  for await (const chunk of createReadStream(path)) {
    hash.update(chunk);
    sizeBytes += chunk.length;
  }
  return { sizeBytes, sha256: hash.digest('hex') };
}

export async function createBackupChecksums(backupPath) {
  const storagePath = resolve(backupPath, 'storage');
  for (const path of [backupPath, storagePath]) {
    const info = await lstat(path);
    if (!info.isDirectory() || info.isSymbolicLink()) {
      throw new Error('Backup checksum directory must not be a symbolic link');
    }
  }
  const files = await collectBackupObjects(storagePath);
  if (!files.ok) throw new Error(files.message);
  const objects = [];
  for (const file of files.details.objects) {
    objects.push({ key: file.key, ...(await checksumFile(file.path)) });
  }
  objects.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
  return {
    database: await checksumFile(resolve(backupPath, 'database.dump')),
    objects,
  };
}

export function hasValidBackupChecksums(manifest) {
  const validEntry = (entry) =>
    entry &&
    Number.isSafeInteger(entry.sizeBytes) &&
    entry.sizeBytes >= 0 &&
    typeof entry.sha256 === 'string' &&
    /^[a-f0-9]{64}$/.test(entry.sha256);
  if (
    manifest?.formatVersion !== 2 ||
    !validEntry(manifest.database) ||
    manifest.database.sizeBytes === 0 ||
    !Array.isArray(manifest.storage?.objects)
  )
    return false;
  const seen = new Set();
  let totalBytes = 0;
  for (const entry of manifest.storage.objects) {
    if (
      !validEntry(entry) ||
      typeof entry.key !== 'string' ||
      entry.key.includes('\\') ||
      entry.key.includes('\0') ||
      entry.key
        .split('/')
        .some((part) => part === '' || part === '.' || part === '..') ||
      seen.has(entry.key)
    )
      return false;
    seen.add(entry.key);
    totalBytes += entry.sizeBytes;
  }
  return (
    Number.isSafeInteger(totalBytes) &&
    manifest.storage.objectCount === seen.size &&
    manifest.storage.totalBytes === totalBytes
  );
}

export async function verifyBackupChecksums({ backupPath, manifest }) {
  if (!hasValidBackupChecksums(manifest)) {
    return failure(
      'BACKUP_CHECKSUMS_INVALID',
      'Backup checksum metadata is missing or invalid',
    );
  }
  try {
    const actual = await createBackupChecksums(backupPath);
    const expected = new Map(
      manifest.storage.objects.map((entry) => [entry.key, entry]),
    );
    const matches = (a, b) =>
      a && b && a.sizeBytes === b.sizeBytes && a.sha256 === b.sha256;
    if (
      !matches(actual.database, manifest.database) ||
      actual.objects.length !== expected.size ||
      actual.objects.some((entry) => !matches(entry, expected.get(entry.key)))
    ) {
      return failure(
        'BACKUP_CHECKSUM_MISMATCH',
        'Backup file contents do not match the manifest',
      );
    }
    return success(
      'BACKUP_CHECKSUMS_OK',
      'Backup file checksums match the manifest',
    );
  } catch (error) {
    return failure(
      'BACKUP_CHECKSUM_FAILED',
      'Unable to verify backup file checksums',
      {
        error: formatError(error),
      },
    );
  }
}
