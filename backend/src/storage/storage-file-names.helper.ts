import { randomUUID } from 'node:crypto';
import { extname } from 'node:path';
import type { StorageFile } from '@prisma/client';
import { StorageDocumentType } from '@prisma/client';
import type { StorageOwnerContext, UploadedFileInput } from './storage.types';

export function createStorageObjectKey(params: {
  documentType: StorageDocumentType;
  extension: string;
  owner: StorageOwnerContext;
}) {
  return `equipment/${params.owner.entityId}/${params.documentType}/${randomUUID()}.${params.extension}`;
}

export function getSafeExtension(file: UploadedFileInput) {
  return (
    getExtensionFromName(file.originalname) ||
    getExtensionByMimeType(file.mimetype) ||
    'bin'
  );
}

export function normalizeOriginalFileName(fileName: string) {
  const cleanFileName = fileName.trim();

  if (!cleanFileName) {
    return fileName;
  }

  return decodeMojibakeText(cleanFileName);
}

export function getExtensionFromName(fileName: string) {
  const extension = extname(fileName).replace(/^\./, '').toLowerCase();

  if (!extension || !/^[a-z0-9]{1,16}$/.test(extension)) {
    return null;
  }

  return extension;
}

export function getExtensionByMimeType(mimeType?: string) {
  const extensionsByMimeType: Record<string, string> = {
    'application/msword': 'doc',
    'application/octet-stream': 'bin',
    'application/pdf': 'pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
      'docx',
    'image/bmp': 'bmp',
    'image/gif': 'gif',
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/tiff': 'tiff',
    'image/webp': 'webp',
    'text/plain': 'txt',
  };

  return mimeType ? extensionsByMimeType[mimeType.toLowerCase()] : undefined;
}

export function isPdfStorageFile(file: StorageFile) {
  return (
    file.mimeType.toLowerCase() === 'application/pdf' ||
    getExtensionFromName(file.objectKey) === 'pdf' ||
    getExtensionFromName(file.originalName) === 'pdf'
  );
}

export function isImageStorageFile(file: StorageFile) {
  return file.mimeType.toLowerCase().startsWith('image/');
}

function decodeMojibakeText(value: string) {
  if (!/[\u00d0\u00d1\u00c2]/.test(value)) {
    return value;
  }

  const decodedValue = Buffer.from(value, 'latin1').toString('utf8');

  if (
    decodedValue.includes('\uFFFD') ||
    !/[\u0400-\u04ff]/.test(decodedValue)
  ) {
    return value;
  }

  return decodedValue;
}
