import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma, StorageFile } from '@prisma/client';
import { AuditAction, StorageDocumentType } from '@prisma/client';
import { AuditLogService } from '../audit/audit-log.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  toAuditModule,
  toStorageFileDisplayNameInList,
  toStorageFileDto,
} from './storage-file.mapper';
import { StorageOwnerLockService } from './storage-owner-lock.service';
import type { StorageOwnerContext } from './storage.types';

@Injectable()
export class StorageFilePrimaryService {
  constructor(
    private readonly auditLog: AuditLogService,
    private readonly ownerLock: StorageOwnerLockService,
    private readonly prisma: PrismaService,
  ) {}

  async setPrimaryFileById(params: { fileId: number; userId?: string | null }) {
    const updatedFile = await this.prisma.$transaction(async (tx) => {
      const initialFile = await tx.storageFile.findFirst({
        where: {
          deletedAt: null,
          id: params.fileId,
        },
      });

      if (!initialFile) {
        throw new NotFoundException('Файл не найден.');
      }

      const owner = this.toOwnerContext(initialFile);
      await this.ownerLock.lock(tx, owner);

      const file = await tx.storageFile.findFirst({
        where: {
          deletedAt: null,
          id: params.fileId,
          ownerEntityId: owner.entityId,
          ownerEntityType: owner.entityType,
          ownerModule: owner.module,
        },
      });

      if (!file) {
        throw new NotFoundException('Файл не найден.');
      }

      if (file.documentType !== StorageDocumentType.equipment_photo) {
        throw new BadRequestException({
          code: 'UNSUPPORTED_PRIMARY_FILE',
          message: 'Основным можно сделать только фото оборудования.',
        });
      }

      const activeFiles = await this.findActiveOwnerFiles(tx, owner);

      if (file.isPrimary) {
        return file;
      }

      const previousPrimaryFile =
        activeFiles.find((activeFile) => activeFile.isPrimary) ?? null;
      const previousPrimaryDisplayName = previousPrimaryFile
        ? toStorageFileDisplayNameInList(previousPrimaryFile, activeFiles)
        : null;
      const nextPrimaryDisplayName = toStorageFileDisplayNameInList(
        file,
        activeFiles,
      );

      await tx.storageFile.updateMany({
        data: { isPrimary: false },
        where: {
          deletedAt: null,
          documentType: file.documentType,
          ownerEntityId: file.ownerEntityId,
          ownerEntityType: file.ownerEntityType,
          ownerModule: file.ownerModule,
        },
      });

      const nextUpdatedFile = await tx.storageFile.update({
        data: { isPrimary: true },
        where: { id: file.id },
      });

      await this.auditLog.writeFieldChanges({
        action: AuditAction.UPDATE,
        entityId: file.ownerEntityId,
        entityType: file.ownerEntityType,
        fields: [
          {
            fieldName: 'Основной файл',
            newValue: nextPrimaryDisplayName,
            oldValue: previousPrimaryDisplayName,
          },
        ],
        module: toAuditModule(file.ownerModule),
        tx,
        userId: params.userId,
      });

      return nextUpdatedFile;
    });

    return toStorageFileDto(updatedFile);
  }

  private findActiveOwnerFiles(
    tx: Prisma.TransactionClient,
    owner: StorageOwnerContext,
  ) {
    return tx.storageFile.findMany({
      orderBy: [{ isPrimary: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
      where: {
        deletedAt: null,
        ownerEntityId: owner.entityId,
        ownerEntityType: owner.entityType,
        ownerModule: owner.module,
      },
    });
  }

  private toOwnerContext(file: StorageFile): StorageOwnerContext {
    return {
      entityId: file.ownerEntityId,
      entityType: file.ownerEntityType,
      module: file.ownerModule,
    };
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
