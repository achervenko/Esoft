import { AuditModule, StorageDocumentType, StorageOwnerModule, type StorageFile } from '@prisma/client';
import { AuditLogService } from '../audit/audit-log.service';
import { PrismaService } from '../prisma/prisma.service';
import { StorageFilePolicyService } from './storage-file-policy.service';
import { StorageFilePrimaryService } from './storage-file-primary.service';
import { StorageOwnerLockService } from './storage-owner-lock.service';

describe('StorageFilePrimaryService', () => {
  let auditLog: jest.Mocked<Pick<AuditLogService, 'writeFieldChanges'>>;
  let ownerLock: jest.Mocked<Pick<StorageOwnerLockService, 'lock'>>;
  let policy: jest.Mocked<Pick<StorageFilePolicyService, 'assertCanBePrimary' | 'canBePrimary'>>;
  let prisma: { $transaction: jest.Mock };
  let service: StorageFilePrimaryService;

  beforeEach(() => {
    auditLog = { writeFieldChanges: jest.fn().mockResolvedValue(undefined) };
    ownerLock = { lock: jest.fn().mockResolvedValue(undefined) };
    policy = {
      assertCanBePrimary: jest.fn(),
      canBePrimary: jest.fn().mockReturnValue(true),
    };
    prisma = {
      $transaction: jest.fn((operation: (tx: unknown) => Promise<unknown>) =>
        operation(createPrimaryTx()),
      ),
    };

    service = new StorageFilePrimaryService(
      auditLog as never,
      ownerLock as never,
      policy as never,
      prisma as never as PrismaService,
    );
  });

  it('sets primary only for active files of the same owner and documentType', async () => {
    const tx = createPrimaryTx();
    prisma.$transaction.mockImplementationOnce(
      (operation: (transaction: typeof tx) => Promise<unknown>) => operation(tx),
    );

    await service.setPrimaryFile({
      audit: { actionModule: AuditModule.EQUIPMENT },
      fileId: 2,
      owner: owner(),
      userId: 'user-1',
    });

    expect(ownerLock.lock).toHaveBeenCalledWith(tx, owner());
    expect(tx.storageFile.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          deletedAt: null,
          documentType: StorageDocumentType.equipment_photo,
          ownerEntityId: 10,
          ownerEntityType: 'equipment',
          ownerModule: StorageOwnerModule.EQUIPMENT,
        }),
      }),
    );
    expect(tx.storageFile.updateMany).toHaveBeenCalledWith({
      data: { isPrimary: false },
      where: {
        deletedAt: null,
        documentType: StorageDocumentType.equipment_photo,
        ownerEntityId: 10,
        ownerEntityType: 'equipment',
        ownerModule: StorageOwnerModule.EQUIPMENT,
      },
    });
    expect(tx.storageFile.update).toHaveBeenCalledWith({
      data: { isPrimary: true },
      where: { id: 2 },
    });
    expect(auditLog.writeFieldChanges).toHaveBeenCalledWith(
      expect.objectContaining({
        entityId: 10,
        entityType: 'equipment',
        module: AuditModule.EQUIPMENT,
      }),
    );
  });

  it('assigns next primary after deleting primary file only within same documentType', async () => {
    const tx = {
      storageFile: {
        findFirst: jest.fn().mockResolvedValue(
          createStorageFile({
            id: 3,
            documentType: StorageDocumentType.equipment_photo,
            isPrimary: false,
          }),
        ),
        update: jest.fn().mockResolvedValue(undefined),
      },
    };

    await service.assignNextPrimaryAfterDelete(
      tx as never,
      createStorageFile({
        documentType: StorageDocumentType.equipment_photo,
        isPrimary: true,
      }),
    );

    expect(tx.storageFile.findFirst).toHaveBeenCalledWith({
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      where: {
        deletedAt: null,
        documentType: StorageDocumentType.equipment_photo,
        ownerEntityId: 10,
        ownerEntityType: 'equipment',
        ownerModule: StorageOwnerModule.EQUIPMENT,
      },
    });
    expect(tx.storageFile.update).toHaveBeenCalledWith({
      data: { isPrimary: true },
      where: { id: 3 },
    });
  });
});

function createPrimaryTx() {
  const selectedFile = createStorageFile({
    id: 2,
    documentType: StorageDocumentType.equipment_photo,
    isPrimary: false,
  });
  const previousPrimary = createStorageFile({
    id: 1,
    documentType: StorageDocumentType.equipment_photo,
    isPrimary: true,
  });

  return {
    storageFile: {
      findFirst: jest.fn().mockResolvedValue(selectedFile),
      findMany: jest.fn().mockResolvedValue([previousPrimary, selectedFile]),
      update: jest.fn().mockResolvedValue({ ...selectedFile, isPrimary: true }),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
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
    documentType: StorageDocumentType.equipment_photo,
    id: 1,
    isPrimary: false,
    mimeType: 'image/jpeg',
    objectKey: 'equipment/equipment/10/equipment_photo/photo.jpg',
    originalName: 'photo.jpg',
    ownerEntityId: 10,
    ownerEntityType: 'equipment',
    ownerModule: StorageOwnerModule.EQUIPMENT,
    sizeBytes: 100n,
    uploadedByUserId: null,
    ...overrides,
  };
}
