import { StorageDocumentType } from '@prisma/client';

export type StorageFileContentValidator = 'image' | 'pdf' | 'document';

export type StorageFileDocumentRule = {
  allowedExtensions?: readonly string[];
  allowedMimeTypes?: readonly string[];
  maxPixelCount?: number;
  validateContent?: StorageFileContentValidator;
};

export type StorageFilePolicyConfig = {
  documentRules?: Partial<Record<StorageDocumentType, StorageFileDocumentRule>>;
  primaryDocumentTypes: readonly StorageDocumentType[];
  singleDocumentTypes: readonly StorageDocumentType[];
};

export const STORAGE_FILE_POLICY_CONFIG = Symbol('STORAGE_FILE_POLICY_CONFIG');

export const storageFilePolicyConfig: StorageFilePolicyConfig = {
  documentRules: {
    [StorageDocumentType.equipment_photo]: {
      allowedExtensions: ['jpg', 'jpeg', 'png', 'webp'],
      allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
      maxPixelCount: 120_000_000,
      validateContent: 'image',
    },
    [StorageDocumentType.maintenance_instruction]: {
      allowedExtensions: ['pdf'],
      allowedMimeTypes: ['application/pdf'],
      validateContent: 'pdf',
    },
    [StorageDocumentType.passport]: {
      allowedExtensions: ['pdf'],
      allowedMimeTypes: ['application/pdf'],
      validateContent: 'pdf',
    },
  },
  primaryDocumentTypes: [StorageDocumentType.equipment_photo],
  singleDocumentTypes: [StorageDocumentType.passport],
};
