import {
  StorageDocumentType,
  StorageOwnerModule,
  type StorageFile,
} from '@prisma/client';
import { Readable } from 'node:stream';
import { AuditLogService } from '../audit/audit-log.service';
import { PrismaService } from '../prisma/prisma.service';
import { StorageFileService } from './storage-file.service';
import { StorageFilePrimaryService } from './storage-file-primary.service';
import { StorageFileUploadService } from './storage-file-upload.service';
import { StorageImagePreviewService } from './storage-image-preview.service';
import { StorageObjectService } from './storage-object.service';
import { StorageOwnerLockService } from './storage-owner-lock.service';
import { StorageOwnerService } from './storage-owner.service';

describe('StorageFileService', () => {
  let imagePreviewStorage: jest.Mocked<
    Pick<StorageImagePreviewService, 'getPreview'>
  >;
  let objectStorage: jest.Mocked<Pick<StorageObjectService, 'getObject'>>;
  let ownerStorage: jest.Mocked<
    Pick<StorageOwnerService, 'findActiveFileForOwner' | 'findActiveFiles'>
  >;
  let service: StorageFileService;

  beforeEach(() => {
    imagePreviewStorage = {
      getPreview: jest.fn().mockResolvedValue({
        body: Readable.from(Buffer.from('preview')),
        contentLength: 7,
        contentType: 'image/webp',
      }),
    };
    objectStorage = {
      getObject: jest.fn().mockResolvedValue({
        body: Readable.from(Buffer.from('file')),
        contentLength: 4,
        contentType: 'application/pdf',
      }),
    };
    ownerStorage = {
      findActiveFileForOwner: jest.fn().mockResolvedValue(createStorageFile()),
      findActiveFiles: jest.fn().mockResolvedValue([createStorageFile()]),
    };

    service = new StorageFileService(
      {} as AuditLogService,
      objectStorage as never,
      {} as StorageOwnerLockService,
      ownerStorage as never,
      {} as StorageFilePrimaryService,
      imagePreviewStorage as never,
      {} as PrismaService,
      {} as StorageFileUploadService,
    );
  });

  it('loads downloads through owner-bound lookup before reading object storage', async () => {
    await service.getDownload({ fileId: 5, owner: owner() });

    expect(ownerStorage.findActiveFileForOwner).toHaveBeenCalledWith(
      5,
      owner(),
    );
    expect(objectStorage.getObject).toHaveBeenCalledWith(
      'equipment/equipment/10/passport/object.pdf',
    );
  });

  it('loads optimized image previews through owner-bound lookup before preview cache', async () => {
    const imageFile = createStorageFile({
      documentType: StorageDocumentType.equipment_photo,
      mimeType: 'image/jpeg',
      objectKey: 'equipment/equipment/10/equipment_photo/photo.jpg',
      originalName: 'photo.jpg',
    });
    ownerStorage.findActiveFileForOwner.mockResolvedValueOnce(imageFile);
    ownerStorage.findActiveFiles.mockResolvedValueOnce([imageFile]);

    await service.getPreview({ fileId: 6, owner: owner(), size: 'small' });

    expect(ownerStorage.findActiveFileForOwner).toHaveBeenCalledWith(
      6,
      owner(),
    );
    expect(imagePreviewStorage.getPreview).toHaveBeenCalledWith(
      imageFile,
      'small',
    );
  });
});

function owner() {
  return {
    entityId: 10,
    entityType: 'equipment',
    module: StorageOwnerModule.EQUIPMENT,
  };
}

function createStorageFile(overrides: Partial<StorageFile> = {}): StorageFile {
  return {
    bucket: 'bucket',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    deletedAt: null,
    documentType: StorageDocumentType.passport,
    id: 1,
    isPrimary: false,
    mimeType: 'application/pdf',
    objectKey: 'equipment/equipment/10/passport/object.pdf',
    originalName: 'passport.pdf',
    ownerEntityId: 10,
    ownerEntityType: 'equipment',
    ownerModule: StorageOwnerModule.EQUIPMENT,
    sizeBytes: 100n,
    uploadedByUserId: null,
    ...overrides,
  };
}
