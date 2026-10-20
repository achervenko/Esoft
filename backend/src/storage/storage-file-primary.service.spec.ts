import {
  AuditModule,
  StorageDocumentType,
  type StorageFile,
} from '@prisma/client';
import { AuditLogService } from '../audit/audit-log.service';
import { PrismaService } from '../prisma/prisma.service';
import { StorageFilePolicyService } from './storage-file-policy.service';
import { StorageFilePrimaryService } from './storage-file-primary.service';
import { StorageOwnerLockService } from './storage-owner-lock.service';

describe('StorageFilePrimaryService', () => {
  let auditLog: jest.Mocked<Pick<AuditLogService, 'writeFieldChanges'>>;
  let ownerLock: jest.Mocked<Pick<StorageOwnerLockService, 'lock'>>;
  let policy: jest.Mocked<
    Pick<StorageFilePolicyService, 'assertCanBePrimary' | 'canBePrimary'>
  >;
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
      ownerLock,
      policy as never,
      prisma as never as PrismaService,
    );
  });

  it('sets primary only for active files of the same owner and documentType', async () => {
    const tx = createPrimaryTx();
    prisma.$transaction.mockImplementationOnce(
      (operation: (transaction: typeof tx) => Promise<unknown>) =>
        operation(tx),
    );

    await service.setPrimaryFile({
      audit: { actionModule: AuditModule.EQUIPMENT },
      fileId: 2,
      owner: owner(),
      userId: 'user-1',
    });

    expect(ownerLock.lock).toHaveBeenCalledWith(tx, owner());
    expect(tx.storageFile.findMany).toHaveBeenCalledWith({
      orderBy: [{ isPrimary: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
      where: {
        deletedAt: null,
        documentType: StorageDocumentType.equipment_photo,
        ownerEntityId: '10',
        ownerEntityType: 'equipment',
        ownerModule: 'equipment',
      },
    });
    expect(tx.storageFile.updateMany).toHaveBeenCalledWith({
      data: { isPrimary: false },
      where: {
        deletedAt: null,
        isPrimary: true,
        documentType: StorageDocumentType.equipment_photo,
        ownerEntityId: '10',
        ownerEntityType: 'equipment',
        ownerModule: 'equipment',
      },
    });
    expect(tx.storageFile.update).toHaveBeenCalledWith({
      data: { isPrimary: true },
      where: { id: 2 },
    });
    expect(auditLog.writeFieldChanges).toHaveBeenCalledWith(
      expect.objectContaining({
        entityId: 10,
        entityStringId: '10',
        entityType: 'equipment',
        module: AuditModule.EQUIPMENT,
      }),
    );
  });

  it('rejects replacing an immutable primary before any writes', async () => {
    const tx = createPrimaryTx();
    tx.storageFile.findMany.mockResolvedValueOnce([
      createStorageFile({ id: 1, isPrimary: true, isImmutable: true }),
      createStorageFile({ id: 2 }),
    ]);
    prisma.$transaction.mockImplementationOnce(
      (operation: (transaction: typeof tx) => Promise<unknown>) =>
        operation(tx),
    );

    await expect(
      service.setPrimaryFile({
        audit: { actionModule: AuditModule.EQUIPMENT },
        fileId: 2,
        owner: owner(),
      }),
    ).rejects.toMatchObject({ response: { code: 'STORAGE_FILE_IMMUTABLE' } });
    expect(tx.storageFile.updateMany).not.toHaveBeenCalled();
    expect(tx.storageFile.update).not.toHaveBeenCalled();
    expect(auditLog.writeFieldChanges).not.toHaveBeenCalled();
  });

  it('allows switching primary when an immutable file is not primary', async () => {
    const tx = createPrimaryTx();
    tx.storageFile.findMany.mockResolvedValueOnce([
      createStorageFile({ id: 1, isPrimary: true }),
      createStorageFile({ id: 2 }),
      createStorageFile({ id: 3, isImmutable: true }),
    ]);
    prisma.$transaction.mockImplementationOnce(
      (operation: (transaction: typeof tx) => Promise<unknown>) =>
        operation(tx),
    );

    await expect(
      service.setPrimaryFile({
        audit: { actionModule: AuditModule.EQUIPMENT },
        fileId: 2,
        owner: owner(),
      }),
    ).resolves.toMatchObject({ id: 2, isPrimary: true });
    expect(tx.storageFile.updateMany.mock.calls[0]).toMatchObject([
      { where: { isPrimary: true } },
    ]);
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
        isImmutable: false,
        documentType: StorageDocumentType.equipment_photo,
        ownerEntityId: '10',
        ownerEntityType: 'equipment',
        ownerModule: 'equipment',
      },
    });
    expect(tx.storageFile.update).toHaveBeenCalledWith({
      data: { isPrimary: true },
      where: { id: 3 },
    });
  });

  it('leaves immutable files unchanged when no mutable replacement exists', async () => {
    const immutable = createStorageFile({ id: 3, isImmutable: true });
    const tx = {
      storageFile: {
        findFirst: jest.fn(({ where }: { where: { isImmutable?: boolean } }) =>
          Promise.resolve(where.isImmutable === false ? null : immutable),
        ),
        update: jest.fn(),
      },
    };

    await service.assignNextPrimaryAfterDelete(
      tx as never,
      createStorageFile({ isPrimary: true }),
    );
    expect(tx.storageFile.update).not.toHaveBeenCalled();
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
    entityId: '10',
    auditEntityId: 10,
    entityType: 'equipment',
    module: 'equipment',
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
    ownerEntityId: '10',
    ownerEntityType: 'equipment',
    ownerModule: 'equipment',
    isImmutable: false,
    sizeBytes: 100n,
    uploadedByUserId: null,
    ...overrides,
  };
}
