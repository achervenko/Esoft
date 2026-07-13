import type { StorageFile } from '@prisma/client';
import { AuditModule, StorageOwnerModule } from '@prisma/client';
import { createEquipmentDocumentDisplayName } from './equipment-documents.helper';
import {
  getExtensionByMimeType,
  getExtensionFromName,
  normalizeOriginalFileName,
} from './storage-file-names.helper';
import type { StorageFileDto } from './storage.types';

export function toStorageFileDto(
  file: StorageFile,
  displayName = toStorageFileDisplayName(file),
): StorageFileDto {
  return {
    createdAt: file.createdAt,
    deletedAt: file.deletedAt,
    displayName,
    documentType: file.documentType,
    id: file.id,
    isPrimary: file.isPrimary,
    mimeType: file.mimeType,
    originalName: normalizeOriginalFileName(file.originalName),
    sizeBytes: file.sizeBytes.toString(),
  };
}

export function toStorageFileDtos(files: StorageFile[]): StorageFileDto[] {
  const duplicateIndexes = getStorageFileDuplicateIndexes(files);

  return files.map((file, index) =>
    toStorageFileDto(
      file,
      toStorageFileDisplayName(file, duplicateIndexes[index] ?? 1),
    ),
  );
}

export function toStorageFileDisplayNameInList(
  file: StorageFile,
  files: StorageFile[],
) {
  const duplicateIndexes = getStorageFileDuplicateIndexes(files);
  const fileIndex = files.findIndex((item) => item.id === file.id);

  if (fileIndex === -1) {
    return toStorageFileDisplayName(file);
  }

  return toStorageFileDisplayName(file, duplicateIndexes[fileIndex] ?? 1);
}

export function toStorageFileDisplayName(
  file: StorageFile,
  duplicateIndex = 1,
) {
  return appendDuplicateSuffix(
    toStorageFileBaseDisplayName(file),
    duplicateIndex,
  );
}

function toStorageFileBaseDisplayName(file: StorageFile) {
  if (file.ownerModule === StorageOwnerModule.EQUIPMENT) {
    if (file.documentType === 'supporting_document') {
      return normalizeOriginalFileName(file.originalName);
    }

    return createEquipmentDocumentDisplayName({
      documentType: file.documentType,
      equipmentId: file.ownerEntityId,
      extension:
        getExtensionFromName(file.objectKey) ||
        getExtensionFromName(file.originalName) ||
        getExtensionByMimeType(file.mimeType) ||
        'bin',
    });
  }

  return file.originalName;
}

function getStorageFileDuplicateIndexes(files: StorageFile[]) {
  const seenNames = new Map<string, number>();
  const duplicateIndexesByFileId = new Map<number, number>();

  [...files]
    .sort((firstFile, secondFile) => {
      const dateDiff =
        firstFile.createdAt.getTime() - secondFile.createdAt.getTime();

      if (dateDiff !== 0) {
        return dateDiff;
      }

      return firstFile.id - secondFile.id;
    })
    .forEach((file) => {
      const displayName = toStorageFileBaseDisplayName(file);
      const duplicateIndex = (seenNames.get(displayName) ?? 0) + 1;
      seenNames.set(displayName, duplicateIndex);
      duplicateIndexesByFileId.set(file.id, duplicateIndex);
    });

  return files.map((file) => duplicateIndexesByFileId.get(file.id) ?? 1);
}

function appendDuplicateSuffix(fileName: string, duplicateIndex: number) {
  if (duplicateIndex <= 1) {
    return fileName;
  }

  const suffix = ` (${duplicateIndex})`;
  const extensionStart = fileName.lastIndexOf('.');

  if (extensionStart <= 0 || extensionStart === fileName.length - 1) {
    return `${fileName}${suffix}`;
  }

  return `${fileName.slice(0, extensionStart)}${suffix}${fileName.slice(
    extensionStart,
  )}`;
}

export function toAuditModule(module: StorageOwnerModule) {
  const modules: Record<StorageOwnerModule, AuditModule> = {
    [StorageOwnerModule.EQUIPMENT]: AuditModule.EQUIPMENT,
  };

  return modules[module];
}
