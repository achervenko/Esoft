import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { StorageOwnerContext } from './storage.types';
import { assertStorageOwner } from './storage-owner.validation';

@Injectable()
export class StorageOwnerService {
  constructor(private readonly prisma: PrismaService) {}

  async findActiveFiles(owner: StorageOwnerContext) {
    assertStorageOwner(owner);
    return this.prisma.storageFile.findMany({
      where: {
        deletedAt: null,
        ownerEntityId: owner.entityId,
        ownerEntityType: owner.entityType,
        ownerModule: owner.module,
      },
      orderBy: [{ isPrimary: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
    });
  }

  async findActiveFileForOwner(fileId: number, owner: StorageOwnerContext) {
    assertStorageOwner(owner);
    const file = await this.prisma.storageFile.findFirst({
      where: {
        deletedAt: null,
        id: fileId,
        ownerEntityId: owner.entityId,
        ownerEntityType: owner.entityType,
        ownerModule: owner.module,
      },
    });

    if (!file) {
      throw new NotFoundException('Файл не найден.');
    }

    return file;
  }
}
