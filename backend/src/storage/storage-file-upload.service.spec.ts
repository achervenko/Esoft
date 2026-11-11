import { Logger } from '@nestjs/common';
import { AuditModule, StorageDocumentType } from '@prisma/client';
import { StorageFilePolicyService } from './storage-file-policy.service';
import { StorageFileUploadService } from './storage-file-upload.service';
import { StorageFileUploadTransactionService } from './storage-file-upload-transaction.service';
import { StorageObjectService } from './storage-object.service';
import type { UploadedFileInput } from './storage.types';

describe('StorageFileUploadService', () => {
  let objectStorage: jest.Mocked<
    Pick<StorageObjectService, 'bucket' | 'deleteObject' | 'putObject'>
  >;
  let policy: jest.Mocked<
    Pick<StorageFilePolicyService, 'assertFileMatchesDocumentType'>
  >;
  let service: StorageFileUploadService;
  let transactionStorage: jest.Mocked<
    Pick<
      StorageFileUploadTransactionService,
      'createStorageFile' | 'findUploadReplay' | 'trackUpload'
    >
  >;

  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation();

    objectStorage = {
      bucket: 'bucket',
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
      findUploadReplay: jest.fn().mockResolvedValue(null),
      trackUpload: jest.fn().mockResolvedValue('pending-id'),
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

  it('returns a committed upload after response loss without writing another object', async () => {
    const params = {
      audit: { actionModule: AuditModule.EQUIPMENT },
      documentType: StorageDocumentType.passport,
      file: pdfFile(),
      owner: owner(),
      userId: 'user-1',
      requestKey: 'ff89b755-38eb-4874-81b7-84cc8c455052',
    };
    const first = await service.uploadFile(params);
    transactionStorage.findUploadReplay.mockResolvedValue({
      storageFile: createStorageFileRecord(),
      displayName: 'passport.pdf',
    });
    expect(await service.uploadFile(params)).toEqual(first);
    expect(objectStorage.putObject).toHaveBeenCalledTimes(1);
    expect(transactionStorage.createStorageFile).toHaveBeenCalledTimes(1);
    expect(transactionStorage.findUploadReplay.mock.calls[0]).toEqual(
      transactionStorage.findUploadReplay.mock.calls[1],
    );
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

    const policyCall = policy.assertFileMatchesDocumentType.mock.calls[0]?.[0];
    const transactionCall =
      transactionStorage.createStorageFile.mock.calls[0]?.[0];
    const putObjectCall = objectStorage.putObject.mock.calls[0]?.[0];

    expect(policyCall).toMatchObject({
      documentType: StorageDocumentType.passport,
      file: {
        buffer,
        originalname: 'passport.pdf',
        size: buffer.length,
      },
    });
    expect(transactionCall?.file).toMatchObject({ size: buffer.length });
    expect(putObjectCall).toMatchObject({
      body: buffer,
      contentType: 'application/pdf',
    });
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
      userId: 'user-1',
    });

    const policyCall = policy.assertFileMatchesDocumentType.mock.calls[0]?.[0];
    const putObjectCall = objectStorage.putObject.mock.calls[0]?.[0];

    expect(policyCall?.file).toMatchObject({
      buffer: Buffer.from(bytes),
      size: bytes.length,
    });
    expect(putObjectCall).toMatchObject({ body: Buffer.from(bytes) });
  });

  it('routes missing or invalid buffers through validation instead of TypeError', async () => {
    await expect(
      service.uploadFile({
        audit: { actionModule: AuditModule.EQUIPMENT },
        documentType: StorageDocumentType.passport,
        file: undefined,
        owner: owner(),
        userId: 'user-1',
      }),
    ).rejects.toMatchObject({
      response: { code: 'FILE_REQUIRED' },
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
        userId: 'user-1',
      }),
    ).rejects.toMatchObject({
      response: { code: 'EMPTY_FILE' },
    });
  });

  it('reconciles a commit whose acknowledgement was lost', async () => {
    transactionStorage.createStorageFile.mockRejectedValueOnce(
      new Error('COMMIT response lost'),
    );
    transactionStorage.findUploadReplay
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        storageFile: createStorageFileRecord(),
        displayName: 'passport.pdf',
      });

    expect((await service.uploadFile(requestParams())).id).toBe(1);
    expect(transactionStorage.findUploadReplay).toHaveBeenCalledTimes(2);
    expect(objectStorage.deleteObject).not.toHaveBeenCalled();
  });

  it('retains the object for reconciliation when PostgreSQL is unavailable', async () => {
    transactionStorage.createStorageFile.mockRejectedValueOnce(
      new Error('COMMIT response lost'),
    );
    transactionStorage.findUploadReplay
      .mockResolvedValueOnce(null)
      .mockRejectedValueOnce(new Error('DB unavailable'));

    await expect(service.uploadFile(requestParams())).rejects.toMatchObject({
      response: { code: 'STORAGE_UPLOAD_RESULT_UNKNOWN' },
    });
    expect(transactionStorage.trackUpload).toHaveBeenCalledWith(
      expect.objectContaining({
        storedObject: {
          bucket: 'bucket',
          key: objectStorage.putObject.mock.calls[0][0].key,
        },
      }),
    );
    expect(transactionStorage.createStorageFile).toHaveBeenCalledWith(
      expect.objectContaining({
        pendingUploadId: 'pending-id',
      }),
    );
    expect(objectStorage.deleteObject).not.toHaveBeenCalled();

    transactionStorage.findUploadReplay.mockResolvedValueOnce({
      storageFile: createStorageFileRecord(),
      displayName: 'passport.pdf',
    });
    expect((await service.uploadFile(requestParams())).id).toBe(1);
    expect(objectStorage.putObject).toHaveBeenCalledTimes(1);
  });
});

function requestParams() {
  return {
    audit: { actionModule: AuditModule.EQUIPMENT },
    documentType: StorageDocumentType.passport,
    file: pdfFile(),
    owner: owner(),
    requestKey: 'ff89b755-38eb-4874-81b7-84cc8c455052',
    userId: 'user-1',
  };
}

function owner() {
  return {
    entityId: '10',
    auditEntityId: 10,
    entityType: 'equipment',
    module: 'equipment',
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
    ownerEntityId: '10',
    ownerEntityType: 'equipment',
    ownerModule: 'equipment',
    isImmutable: false,
    sizeBytes: 100n,
    uploadedByUserId: null,
    uploadRequestKey: null,
    uploadRequestHash: null,
  };
}
