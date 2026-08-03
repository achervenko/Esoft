import {
  isAbsolute,
  relative,
  resolve,
  sep,
  win32,
} from 'node:path';

import { failure, success } from '../infrastructure/result.mjs';

export function createObjectPathTracker() {
  const directoryPaths = new Set();
  const filePaths = new Set();

  return {
    register({ objectKey, segments }) {
      const normalizedSegments = segments.map(normalizePathSegmentForCollision);
      const filePath = normalizedSegments.join('/');

      if (filePaths.has(filePath) || directoryPaths.has(filePath)) {
        return unsafeObjectKey(objectKey);
      }

      const directorySegments = [];

      for (let index = 0; index < normalizedSegments.length - 1; index += 1) {
        directorySegments.push(normalizedSegments[index]);

        if (filePaths.has(directorySegments.join('/'))) {
          return unsafeObjectKey(objectKey);
        }
      }

      filePaths.add(filePath);

      directorySegments.length = 0;

      for (let index = 0; index < normalizedSegments.length - 1; index += 1) {
        directorySegments.push(normalizedSegments[index]);
        directoryPaths.add(directorySegments.join('/'));
      }

      return success('MINIO_OBJECT_PATH_REGISTERED', 'Object path is unique');
    },
  };
}

export function resolveObjectBackupPath(storagePath, objectKey) {
  if (objectKey.includes('\\')) {
    return unsafeObjectKey(objectKey);
  }

  if (
    isAbsolute(objectKey) ||
    win32.isAbsolute(objectKey) ||
    objectKey.startsWith('/')
  ) {
    return unsafeObjectKey(objectKey);
  }

  const segments = objectKey.split('/');

  if (
    segments.some(
      (segment) => segment === '' || segment === '.' || segment === '..',
    )
  ) {
    return unsafeObjectKey(objectKey);
  }

  if (segments.some(isUnsafeWindowsPathSegment)) {
    return unsafeObjectKey(objectKey);
  }

  const path = resolve(storagePath, ...segments);

  if (!isPathInside(storagePath, path)) {
    return unsafeObjectKey(objectKey);
  }

  return success('MINIO_OBJECT_PATH_SAFE', 'Object key is safe', {
    path,
    segments,
  });
}

function isUnsafeWindowsPathSegment(segment) {
  return (
    /[<>:"|?*\x00-\x1F]/u.test(segment) ||
    /[ .]$/u.test(segment) ||
    isReservedWindowsFileName(segment)
  );
}

function isReservedWindowsFileName(segment) {
  const baseName = segment.split('.')[0].toUpperCase();

  return (
    ['CON', 'PRN', 'AUX', 'NUL'].includes(baseName) ||
    /^COM[1-9]$/u.test(baseName) ||
    /^LPT[1-9]$/u.test(baseName)
  );
}

function normalizePathSegmentForCollision(segment) {
  return segment.toLowerCase();
}

function unsafeObjectKey(objectKey) {
  return failure('MINIO_OBJECT_PATH_UNSAFE', 'MinIO object key is unsafe', {
    objectKey,
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
