import {
  AuditAction,
  AuditModule,
  StorageDocumentType,
  StorageOwnerModule,
  type StorageFile,
} from '@prisma/client';
import { AuditLogService } from '../audit/audit-log.service';
import { PrismaService } from '../prisma/prisma.service';
import { StorageFilePolicyService } from './storage-file-policy.service';
import { StorageFileUploadTransactionService } from './storage-file-upload-transaction.service';
import { StorageOwnerLockService } from './storage-owner-lock.service';

describe('StorageFileUploadTransactionService', () => {
  let auditLog: jest.Mocked<Pick<AuditLogService, 'writeFieldChanges'>>;
  let ownerLock: jest.Mocked<Pick<StorageOwnerLockService, 'lock'>>;
  let policy: jest.Mocked<
    Pick<
      StorageFilePolicyService,
      'assertDocumentCanBeAdded' | 'shouldMakePrimary'
    >
  >;
  let prisma: { $transaction: jest.Mock };
  let service: StorageFileUploadTransactionService;
  let tx: ReturnType<typeof createTx>;

  beforeEach(() => {
    tx = createTx();
    auditLog = { writeFieldChanges: jest.fn().mockResolvedValue(undefined) };
    ownerLock = { lock: jest.fn().mockResolvedValue(undefined) };
    policy = {
      assertDocumentCanBeAdded: jest.fn(),
      shouldMakePrimary: jest.fn().mockReturnValue(true),
    };
    prisma = {
      $transaction: jest.fn((operation: (transaction: typeof tx) => unknown) =>
        operation(tx),
      ),
    };

    service = new StorageFileUploadTransactionService(
      auditLog as never,
      ownerLock,
      policy as never,
      prisma as never as PrismaService,
    );
  });

  it('locks owner, checks policy and creates file with owner/audit context in one transaction', async () => {
    await service.createStorageFile({
      audit: { actionModule: AuditModule.EQUIPMENT },
      documentType: StorageDocumentType.passport,
      file: {
        buffer: Buffer.from('%PDF-1.4\n%%EOF', 'ascii'),
        mimetype: '',
        originalname: 'passport.pdf',
        size: 123,
      },
      owner: owner(),
      storedObject: {
        bucket: 'bucket',
        key: 'equipment/equipment/10/passport/object.pdf',
      },
      userId: 'user-1',
    });

    expect(ownerLock.lock).toHaveBeenCalledWith(tx, owner());
    expect(tx.storageFile.findMany).toHaveBeenCalledWith({
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      where: {
        deletedAt: null,
        ownerEntityId: 10,
        ownerEntityType: 'equipment',
        ownerModule: StorageOwnerModule.EQUIPMENT,
      },
    });
    expect(policy.assertDocumentCanBeAdded).toHaveBeenCalledWith({
      activeFiles: [createStorageFile({ id: 1 })],
      documentType: StorageDocumentType.passport,
    });
    expect(tx.storageFile.create).toHaveBeenCalledWith({
      data: {
        bucket: 'bucket',
        documentType: StorageDocumentType.passport,
        isPrimary: true,
        mimeType: 'application/octet-stream',
        objectKey: 'equipment/equipment/10/passport/object.pdf',
        originalName: 'passport.pdf',
        ownerEntityId: 10,
        ownerEntityType: 'equipment',
        ownerModule: StorageOwnerModule.EQUIPMENT,
        sizeBytes: 123n,
        uploadedByUserId: 'user-1',
      },
    });
    expect(auditLog.writeFieldChanges).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AuditAction.FILE_UPLOAD,
        entityId: 10,
        entityType: 'equipment',
        module: AuditModule.EQUIPMENT,
        tx,
        userId: 'user-1',
      }),
    );
  });
});

function createTx() {
  const activeFile = createStorageFile({ id: 1 });
  const newFile = createStorageFile({ id: 2, originalName: 'passport.pdf' });

  return {
    storageFile: {
      create: jest.fn().mockResolvedValue(newFile),
      findMany: jest.fn().mockResolvedValue([activeFile]),
    },
  };
}

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
    originalName: 'existing.pdf',
    ownerEntityId: 10,
    ownerEntityType: 'equipment',
    ownerModule: StorageOwnerModule.EQUIPMENT,
    sizeBytes: 100n,
    uploadedByUserId: null,
    ...overrides,
  };
}
