import type { StorageDocumentType } from '@prisma/client';

export type StorageFileContentValidator = 'image' | 'pdf';

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
