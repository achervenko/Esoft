import type { Readable } from 'node:stream';
import type { AuditModule, StorageOwnerModule } from '@prisma/client';

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
  id: number;
  mimeType: string;
  originalName: string;
  sizeBytes: string;
};
