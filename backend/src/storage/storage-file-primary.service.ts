import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma, StorageFile } from '@prisma/client';
import { AuditAction, type StorageDocumentType } from '@prisma/client';
import { AuditLogService } from '../audit/audit-log.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  toStorageFileDisplayNameInList,
  toStorageFileDto,
} from './storage-file.mapper';
import { StorageFilePolicyService } from './storage-file-policy.service';
import { StorageOwnerLockService } from './storage-owner-lock.service';
import type { StorageAuditContext, StorageOwnerContext } from './storage.types';

@Injectable()
export class StorageFilePrimaryService {
  constructor(
    private readonly auditLog: AuditLogService,
    private readonly ownerLock: StorageOwnerLockService,
    private readonly policy: StorageFilePolicyService,
    private readonly prisma: PrismaService,
  ) {}

  async setPrimaryFile(params: {
    audit: StorageAuditContext;
    fileId: number;
    owner: StorageOwnerContext;
    userId?: string | null;
  }) {
    const updatedFile = await this.prisma.$transaction(async (tx) => {
      await this.ownerLock.lock(tx, params.owner);

      const file = await tx.storageFile.findFirst({
        where: {
          deletedAt: null,
          id: params.fileId,
          ownerEntityId: params.owner.entityId,
          ownerEntityType: params.owner.entityType,
          ownerModule: params.owner.module,
        },
      });

      if (!file) {
        throw new NotFoundException('Файл не найден.');
      }

      this.policy.assertCanBePrimary(file.documentType);

      const activeFiles = await this.findActiveOwnerFiles(
        tx,
        params.owner,
        file.documentType,
      );

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
        entityId: params.owner.entityId,
        entityType: params.owner.entityType,
        fields: [
          {
            fieldName: 'Основной файл',
            newValue: nextPrimaryDisplayName,
            oldValue: previousPrimaryDisplayName,
          },
        ],
        module: params.audit.actionModule,
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
    documentType: StorageDocumentType,
  ) {
    return tx.storageFile.findMany({
      orderBy: [{ isPrimary: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
      where: {
        deletedAt: null,
        documentType,
        ownerEntityId: owner.entityId,
        ownerEntityType: owner.entityType,
        ownerModule: owner.module,
      },
    });
  }

  async assignNextPrimaryAfterDelete(
    tx: Prisma.TransactionClient,
    file: StorageFile,
  ) {
    if (!file.isPrimary || !this.policy.canBePrimary(file.documentType)) {
      return;
    }

    const nextPrimaryFile = await tx.storageFile.findFirst({
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      where: {
        deletedAt: null,
        documentType: file.documentType,
        ownerEntityId: file.ownerEntityId,
        ownerEntityType: file.ownerEntityType,
        ownerModule: file.ownerModule,
      },
    });

    if (!nextPrimaryFile) {
      return;
    }

    await tx.storageFile.update({
      data: { isPrimary: true },
      where: { id: nextPrimaryFile.id },
    });
  }
}
