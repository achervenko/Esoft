import { InternalServerErrorException, Logger } from '@nestjs/common';
import { AuditModule, StorageDocumentType, StorageOwnerModule } from '@prisma/client';
import { StorageFilePolicyService } from './storage-file-policy.service';
import { StorageFileUploadService } from './storage-file-upload.service';
import { StorageFileUploadTransactionService } from './storage-file-upload-transaction.service';
import { StorageObjectService } from './storage-object.service';
import type { UploadedFileInput } from './storage.types';

describe('StorageFileUploadService', () => {
  let objectStorage: jest.Mocked<Pick<StorageObjectService, 'deleteObject' | 'putObject'>>;
  let policy: jest.Mocked<Pick<StorageFilePolicyService, 'assertFileMatchesDocumentType'>>;
  let service: StorageFileUploadService;
  let transactionStorage: jest.Mocked<
    Pick<StorageFileUploadTransactionService, 'createStorageFile'>
  >;

  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation();

    objectStorage = {
      deleteObject: jest.fn(),
      putObject: jest.fn().mockResolvedValue({
        bucket: 'bucket',
        key: 'equipment/equipment/10/passport/object.pdf',
      }),
    };
    policy = {
      assertFileMatchesDocumentType: jest.fn().mockResolvedValue(undefined),
    };
    transactionStorage = {
      createStorageFile: jest.fn().mockResolvedValue({
        displayName: 'passport.pdf',
        storageFile: createStorageFileRecord(),
      }),
    };

    service = new StorageFileUploadService(
      objectStorage as never,
      policy as never,
      transactionStorage as never,
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('normalizes uploaded input and stores real size from buffer.length', async () => {
    const buffer = Buffer.from('content');

    await service.uploadFile({
      audit: { actionModule: AuditModule.EQUIPMENT },
      documentType: StorageDocumentType.passport,
      file: {
        buffer,
        mimetype: 'application/pdf',
        originalname: '  passport.pdf  ',
        size: 999_999,
      },
      owner: owner(),
      userId: 'user-1',
    });

    expect(policy.assertFileMatchesDocumentType).toHaveBeenCalledWith({
      documentType: StorageDocumentType.passport,
      file: expect.objectContaining({
        buffer,
        originalname: 'passport.pdf',
        size: buffer.length,
      }),
    });
    expect(transactionStorage.createStorageFile).toHaveBeenCalledWith(
      expect.objectContaining({
        file: expect.objectContaining({ size: buffer.length }),
      }),
    );
    expect(objectStorage.putObject).toHaveBeenCalledWith(
      expect.objectContaining({
        body: buffer,
        contentType: 'application/pdf',
      }),
    );
  });

  it('converts Uint8Array body to Buffer before validation and storage', async () => {
    const bytes = new Uint8Array([1, 2, 3]);

    await service.uploadFile({
      audit: { actionModule: AuditModule.EQUIPMENT },
      documentType: StorageDocumentType.supporting_document,
      file: {
        buffer: bytes as unknown as Buffer,
        mimetype: 'application/octet-stream',
        originalname: 'raw.bin',
        size: 999,
      },
      owner: owner(),
    });

    expect(policy.assertFileMatchesDocumentType).toHaveBeenCalledWith(
      expect.objectContaining({
        file: expect.objectContaining({
          buffer: Buffer.from(bytes),
          size: bytes.length,
        }),
      }),
    );
    expect(objectStorage.putObject).toHaveBeenCalledWith(
      expect.objectContaining({ body: Buffer.from(bytes) }),
    );
  });

  it('routes missing or invalid buffers through validation instead of TypeError', async () => {
    await expect(
      service.uploadFile({
        audit: { actionModule: AuditModule.EQUIPMENT },
        documentType: StorageDocumentType.passport,
        file: undefined,
        owner: owner(),
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'FILE_REQUIRED' }),
    });

    await expect(
      service.uploadFile({
        audit: { actionModule: AuditModule.EQUIPMENT },
        documentType: StorageDocumentType.passport,
        file: {
          buffer: 'not-a-buffer' as unknown as Buffer,
          mimetype: 'application/pdf',
          originalname: 'passport.pdf',
          size: 100,
        },
        owner: owner(),
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'EMPTY_FILE' }),
    });
  });

  it('removes uploaded object and masks DB failure with upload error contract', async () => {
    const dbError = new Error('database failed');
    transactionStorage.createStorageFile.mockRejectedValueOnce(dbError);

    await expect(
      service.uploadFile({
        audit: { actionModule: AuditModule.EQUIPMENT },
        documentType: StorageDocumentType.passport,
        file: pdfFile(),
        owner: owner(),
      }),
    ).rejects.toBeInstanceOf(InternalServerErrorException);

    expect(objectStorage.deleteObject).toHaveBeenCalledWith(
      'equipment/equipment/10/passport/object.pdf',
    );
  });

  it('does not mask the main transaction error when orphan cleanup fails', async () => {
    transactionStorage.createStorageFile.mockRejectedValueOnce(
      new Error('database failed'),
    );
    objectStorage.deleteObject.mockRejectedValueOnce(new Error('cleanup failed'));

    await expect(
      service.uploadFile({
        audit: { actionModule: AuditModule.EQUIPMENT },
        documentType: StorageDocumentType.passport,
        file: pdfFile(),
        owner: owner(),
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'UPLOAD_FAILED' }),
    });
  });
});

function owner() {
  return {
    entityId: 10,
    entityType: 'equipment',
    module: StorageOwnerModule.EQUIPMENT,
  };
}

function pdfFile(): UploadedFileInput {
  const buffer = Buffer.from('%PDF-1.4\n%%EOF', 'ascii');

  return {
    buffer,
    mimetype: 'application/pdf',
    originalname: 'passport.pdf',
    size: buffer.length,
  };
}

function createStorageFileRecord() {
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
  };
}
