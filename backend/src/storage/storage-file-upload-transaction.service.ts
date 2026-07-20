import { Injectable } from '@nestjs/common';
import { AuditAction, Prisma, StorageDocumentType } from '@prisma/client';
import { AuditLogService } from '../audit/audit-log.service';
import { PrismaService } from '../prisma/prisma.service';
import { toStorageFileDisplayNameInList } from './storage-file.mapper';
import { StorageFileUploadPolicyService } from './storage-file-upload-policy.service';
import { StorageOwnerLockService } from './storage-owner-lock.service';
import type {
  StorageAuditContext,
  StorageOwnerContext,
  UploadedFileInput,
} from './storage.types';

@Injectable()
export class StorageFileUploadTransactionService {
  constructor(
    private readonly auditLog: AuditLogService,
    private readonly ownerLock: StorageOwnerLockService,
    private readonly policy: StorageFileUploadPolicyService,
    private readonly prisma: PrismaService,
  ) {}

  createStorageFile(params: {
    audit: StorageAuditContext;
    documentType: StorageDocumentType;
    file: UploadedFileInput;
    owner: StorageOwnerContext;
    storedObject: { bucket: string; key: string };
    userId?: string | null;
  }) {
    return this.prisma.$transaction(async (tx) => {
      await this.ownerLock.lock(tx, params.owner);
      const activeFilesBeforeUpload = await this.findActiveOwnerFiles(
        tx,
        params.owner,
      );

      this.policy.assertDocumentCanBeAdded({
        activeFiles: activeFilesBeforeUpload,
        documentType: params.documentType,
      });

      const storageFile = await tx.storageFile.create({
        data: {
          bucket: params.storedObject.bucket,
          documentType: params.documentType,
          isPrimary: this.policy.shouldMakePrimary({
            activeFiles: activeFilesBeforeUpload,
            documentType: params.documentType,
          }),
          mimeType: params.file.mimetype || 'application/octet-stream',
          objectKey: params.storedObject.key,
          originalName: params.file.originalname,
          ownerEntityId: params.owner.entityId,
          ownerEntityType: params.owner.entityType,
          ownerModule: params.owner.module,
          sizeBytes: BigInt(params.file.size),
          uploadedByUserId: params.userId ?? null,
        },
      });

      const activeFilesAfterUpload = [storageFile, ...activeFilesBeforeUpload];
      const displayName = toStorageFileDisplayNameInList(
        storageFile,
        activeFilesAfterUpload,
      );

      await this.auditLog.writeFieldChanges({
        action: AuditAction.FILE_UPLOAD,
        entityId: params.audit.entityId,
        entityType: params.audit.entityType,
        fields: [
          {
            fieldName: 'Файл',
            newValue: displayName,
            oldValue: null,
          },
        ],
        module: params.audit.actionModule,
        tx,
        userId: params.userId,
      });

      return {
        displayName,
        storageFile,
      };
    });
  }

  private async findActiveOwnerFiles(
    tx: Prisma.TransactionClient,
    owner: StorageOwnerContext,
  ) {
    return tx.storageFile.findMany({
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      where: {
        deletedAt: null,
        ownerEntityId: owner.entityId,
        ownerEntityType: owner.entityType,
        ownerModule: owner.module,
      },
    });
  }
}
