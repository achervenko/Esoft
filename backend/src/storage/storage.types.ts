import type { Readable } from 'node:stream';
import type {
  AuditModule,
  StorageDocumentType,
  StorageOwnerModule,
} from '@prisma/client';

export type { StorageDocumentType };

export type PutObjectInput = {
  body: Buffer | Uint8Array | Readable | string;
  contentType?: string;
  key: string;
};

export type StoredObject = {
  body: Readable;
  contentLength?: number;
  contentType?: string;
};

export type StorageImagePreviewSize = 'small' | 'medium';

export type UploadedFileInput = {
  buffer: Buffer;
  mimetype?: string;
  originalname: string;
  size: number;
};

export type StorageOwnerContext = {
  entityId: number;
  entityType: string;
  module: StorageOwnerModule;
};

export type StorageAuditContext = {
  actionModule: AuditModule;
  entityId: number;
  entityType: string;
};

export type StorageFileDto = {
  createdAt: Date;
  deletedAt: Date | null;
  displayName: string;
  documentType: StorageDocumentType;
  id: number;
  isPrimary: boolean;
  mimeType: string;
  originalName: string;
  sizeBytes: string;
};
