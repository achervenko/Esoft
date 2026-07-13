import { BadRequestException, Injectable } from '@nestjs/common';
import type { Prisma, StorageFile } from '@prisma/client';
import { StorageDocumentType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { toStorageFileDto } from './storage-file.mapper';
import { StorageOwnerService } from './storage-owner.service';

@Injectable()
export class StorageFilePrimaryService {
  constructor(
    private readonly ownerStorage: StorageOwnerService,
    private readonly prisma: PrismaService,
  ) {}

  async setPrimaryFileById(fileId: number) {
    const file = await this.ownerStorage.findActiveFile(fileId);

    if (file.documentType !== StorageDocumentType.equipment_photo) {
      throw new BadRequestException({
        code: 'UNSUPPORTED_PRIMARY_FILE',
        message:
          '\u041e\u0441\u043d\u043e\u0432\u043d\u044b\u043c \u043c\u043e\u0436\u043d\u043e \u0441\u0434\u0435\u043b\u0430\u0442\u044c \u0442\u043e\u043b\u044c\u043a\u043e \u0444\u043e\u0442\u043e \u043e\u0431\u043e\u0440\u0443\u0434\u043e\u0432\u0430\u043d\u0438\u044f.',
      });
    }

    await this.prisma.$transaction([
      this.prisma.storageFile.updateMany({
        data: { isPrimary: false },
        where: {
          deletedAt: null,
          documentType: file.documentType,
          ownerEntityId: file.ownerEntityId,
          ownerEntityType: file.ownerEntityType,
          ownerModule: file.ownerModule,
        },
      }),
      this.prisma.storageFile.update({
        data: { isPrimary: true },
        where: { id: file.id },
      }),
    ]);

    const updatedFile = await this.ownerStorage.findActiveFile(file.id);
    return toStorageFileDto(updatedFile);
  }

  async assignNextPrimaryAfterDelete(
    tx: Prisma.TransactionClient,
    file: StorageFile,
  ) {
    if (
      !file.isPrimary ||
      file.documentType !== StorageDocumentType.equipment_photo
    ) {
      return;
    }

    const nextPrimaryPhoto = await tx.storageFile.findFirst({
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      where: {
        deletedAt: null,
        documentType: StorageDocumentType.equipment_photo,
        ownerEntityId: file.ownerEntityId,
        ownerEntityType: file.ownerEntityType,
        ownerModule: file.ownerModule,
      },
    });

    if (!nextPrimaryPhoto) {
      return;
    }

    await tx.storageFile.update({
      data: { isPrimary: true },
      where: { id: nextPrimaryPhoto.id },
    });
  }
}
