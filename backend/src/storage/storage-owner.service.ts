import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { StorageOwnerContext } from './storage.types';

@Injectable()
export class StorageOwnerService {
  constructor(private readonly prisma: PrismaService) {}

  async findActiveFiles(owner: StorageOwnerContext) {
    return this.prisma.storageFile.findMany({
      where: {
        deletedAt: null,
        ownerEntityId: owner.entityId,
        ownerEntityType: owner.entityType,
        ownerModule: owner.module,
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
  }

  async findActiveFile(fileId: number) {
    const file = await this.prisma.storageFile.findFirst({
      where: {
        deletedAt: null,
        id: fileId,
      },
    });

    if (!file) {
      throw new NotFoundException('Файл не найден.');
    }

    return file;
  }

  async findActiveFileForOwner(fileId: number, owner: StorageOwnerContext) {
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
