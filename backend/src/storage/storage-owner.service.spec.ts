import { NotFoundException } from '@nestjs/common';
import { StorageOwnerModule, type StorageFile } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StorageOwnerService } from './storage-owner.service';
import type { StorageOwnerContext } from './storage.types';

describe('StorageOwnerService', () => {
  let findFirst: jest.Mock;
  let service: StorageOwnerService;

  const owner: StorageOwnerContext = {
    entityId: 10,
    entityType: 'equipment',
    module: StorageOwnerModule.EQUIPMENT,
  };

  beforeEach(() => {
    findFirst = jest.fn();
    service = new StorageOwnerService({
      storageFile: {
        findFirst,
      },
    } as never as PrismaService);
  });

  it('returns an active file only for the exact owner context', async () => {
    const file = createStorageFile({ id: 5 });
    findFirst.mockResolvedValue(file);

    await expect(service.findActiveFileForOwner(5, owner)).resolves.toBe(file);

    expect(findFirst).toHaveBeenCalledWith({
      where: {
        deletedAt: null,
        id: 5,
        ownerEntityId: owner.entityId,
        ownerEntityType: owner.entityType,
        ownerModule: owner.module,
      },
    });
  });

  it.each([
    ['another entityId'],
    ['another entityType'],
    ['another module'],
    ['soft-deleted file'],
  ])('throws NotFoundException when file belongs to %s', async () => {
    findFirst.mockResolvedValue(null);

    await expect(
      service.findActiveFileForOwner(5, owner),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

function createStorageFile(overrides: Partial<StorageFile> = {}): StorageFile {
  return {
    bucket: 'bucket',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    deletedAt: null,
    documentType: 'passport',
    id: 1,
    isPrimary: false,
    mimeType: 'application/pdf',
    objectKey: 'equipment/equipment/10/passport/file.pdf',
    originalName: 'passport.pdf',
    ownerEntityId: 10,
    ownerEntityType: 'equipment',
    ownerModule: StorageOwnerModule.EQUIPMENT,
    sizeBytes: 100n,
    uploadedByUserId: null,
    ...overrides,
  };
}
