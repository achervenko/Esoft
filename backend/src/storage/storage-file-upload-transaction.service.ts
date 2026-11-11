import { ConflictException, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { AuditAction, Prisma, StorageDocumentType } from '@prisma/client';
import { AuditLogService } from '../audit/audit-log.service';
import { PrismaService } from '../prisma/prisma.service';
import { toStorageFileDisplayNameInList } from './storage-file.mapper';
import { StorageFilePolicyService } from './storage-file-policy.service';
import { StorageOwnerLockService } from './storage-owner-lock.service';
import type {
  StorageAuditContext,
  StorageOwnerContext,
  UploadedFileInput,
} from './storage.types';

export type StorageUploadRequest = { key: string; hash: string };

@Injectable()
export class StorageFileUploadTransactionService {
  constructor(
    private readonly auditLog: AuditLogService,
    private readonly ownerLock: StorageOwnerLockService,
    private readonly policy: StorageFilePolicyService,
    private readonly prisma: PrismaService,
  ) {}

  async trackUpload(params: {
    owner: StorageOwnerContext;
    documentType: StorageDocumentType;
    file: UploadedFileInput;
    sha256: string;
    userId: string;
    storedObject: { bucket: string; key: string };
  }) {
    const { owner, file, storedObject } = params;
    const id = randomUUID();
    await this.prisma.storageUpload.create({
      data: {
        id,
        bucket: storedObject.bucket,
        objectKey: storedObject.key,
        originalName: file.originalname,
        mimeType: file.mimetype || 'application/octet-stream',
        sizeBytes: BigInt(file.size),
        sha256: params.sha256,
        documentType: params.documentType,
        ownerModule: owner.module,
        ownerEntityType: owner.entityType,
        uploadedByUserId: params.userId,
      },
    });
    return id;
  }

  async findUploadReplay(
    owner: StorageOwnerContext,
    request: StorageUploadRequest,
    db: Pick<Prisma.TransactionClient, 'storageFile'> = this.prisma,
  ) {
    const storageFile = await db.storageFile.findUnique({
      where: {
        ownerModule_ownerEntityType_ownerEntityId_uploadRequestKey: {
          ownerModule: owner.module,
          ownerEntityType: owner.entityType,
          ownerEntityId: owner.entityId,
          uploadRequestKey: request.key,
        },
      },
    });
    if (!storageFile) return null;
    if (
      storageFile.uploadRequestHash !== request.hash ||
      storageFile.deletedAt
    ) {
      throw new ConflictException({
        code: 'STORAGE_UPLOAD_REQUEST_CONFLICT',
        message:
          'Ключ загрузки уже использован для другого или удалённого файла.',
      });
    }
    return {
      storageFile,
      displayName: toStorageFileDisplayNameInList(
        storageFile,
        await this.findActiveOwnerFiles(db, owner),
      ),
    };
  }

  createStorageFile(params: {
    audit: StorageAuditContext;
    documentType: StorageDocumentType;
    file: UploadedFileInput;
    owner: StorageOwnerContext;
    request?: StorageUploadRequest;
    storedObject: { bucket: string; key: string };
    pendingUploadId: string;
    userId?: string | null;
  }) {
    return this.prisma.$transaction(async (tx) => {
      await this.ownerLock.lock(tx, params.owner);
      if (params.request) {
        const replay = await this.findUploadReplay(
          params.owner,
          params.request,
          tx,
        );
        if (replay) return replay;
      }
      // Consuming the cleanup record and creating metadata commit together.
      const pending = await tx.storageUpload.deleteMany({
        where: {
          id: params.pendingUploadId,
          objectKey: params.storedObject.key,
        },
      });
      if (!pending.count) {
        throw new ConflictException({
          code: 'STORAGE_UPLOAD_UNAVAILABLE',
          message: 'Срок загрузки истёк. Повторите загрузку.',
        });
      }
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
          ...(params.request && {
            uploadRequestKey: params.request.key,
            uploadRequestHash: params.request.hash,
          }),
        },
      });

      const activeFilesAfterUpload = [storageFile, ...activeFilesBeforeUpload];
      const displayName = toStorageFileDisplayNameInList(
        storageFile,
        activeFilesAfterUpload,
      );

      await this.auditLog.writeFieldChanges({
        action: AuditAction.FILE_UPLOAD,
        entityId: params.owner.auditEntityId,
        entityStringId: params.owner.entityId,
        entityType: params.owner.entityType,
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
    tx: Pick<Prisma.TransactionClient, 'storageFile'>,
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
