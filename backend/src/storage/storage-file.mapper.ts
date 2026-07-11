import type { StorageFile } from '@prisma/client';
import { AuditModule, StorageOwnerModule } from '@prisma/client';
import { createEquipmentDocumentDisplayName } from './equipment-documents.helper';
import {
  getExtensionByMimeType,
  getExtensionFromName,
  normalizeOriginalFileName,
} from './storage-file-names.helper';
import type { StorageFileDto } from './storage.types';

export function toStorageFileDto(file: StorageFile): StorageFileDto {
  return {
    createdAt: file.createdAt,
    deletedAt: file.deletedAt,
    displayName: toStorageFileDisplayName(file),
    documentType: file.documentType,
    id: file.id,
    mimeType: file.mimeType,
    originalName: normalizeOriginalFileName(file.originalName),
    sizeBytes: file.sizeBytes.toString(),
  };
}

export function toStorageFileDisplayName(file: StorageFile) {
  if (file.ownerModule === StorageOwnerModule.EQUIPMENT) {
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

export function toAuditModule(module: StorageOwnerModule) {
  const modules: Record<StorageOwnerModule, AuditModule> = {
    [StorageOwnerModule.EQUIPMENT]: AuditModule.EQUIPMENT,
  };

  return modules[module];
}
