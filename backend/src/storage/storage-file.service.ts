import { BadRequestException, Injectable } from '@nestjs/common';
import type { StorageFile } from '@prisma/client';
import { AuditAction, StorageDocumentType } from '@prisma/client';
import { AuditLogService } from '../audit/audit-log.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  toAuditModule,
  toStorageFileDisplayNameInList,
  toStorageFileDto,
  toStorageFileDtos,
} from './storage-file.mapper';
import {
  isPdfStorageFile,
  isImageStorageFile,
} from './storage-file-names.helper';
import { StorageFilePrimaryService } from './storage-file-primary.service';
import { StorageFileUploadService } from './storage-file-upload.service';
import { StorageImagePreviewService } from './storage-image-preview.service';
import { StorageObjectService } from './storage-object.service';
import { StorageOwnerService } from './storage-owner.service';
import type {
  StorageAuditContext,
  StorageFileDto,
  StorageImagePreviewSize,
  StorageOwnerContext,
  UploadedFileInput,
} from './storage.types';

@Injectable()
export class StorageFileService {
  constructor(
    private readonly auditLog: AuditLogService,
    private readonly objectStorage: StorageObjectService,
    private readonly ownerStorage: StorageOwnerService,
    private readonly primaryStorage: StorageFilePrimaryService,
    private readonly imagePreviewStorage: StorageImagePreviewService,
    private readonly prisma: PrismaService,
    private readonly uploadStorage: StorageFileUploadService,
  ) {}

  async listFiles(owner: StorageOwnerContext): Promise<StorageFileDto[]> {
    const files = await this.ownerStorage.findActiveFiles(owner);
    return toStorageFileDtos(files);
  }

  async uploadFile(params: {
    audit: StorageAuditContext;
    documentType: StorageDocumentType;
    file: UploadedFileInput;
    owner: StorageOwnerContext;
    userId?: string | null;
  }): Promise<StorageFileDto> {
    return this.uploadStorage.uploadFile(params);
  }

  async getDownload(fileId: number) {
    const file = await this.ownerStorage.findActiveFile(fileId);
    const object = await this.objectStorage.getObject(file.objectKey);

    return {
      body: object.body,
      contentLength: object.contentLength,
      contentType: object.contentType || file.mimeType,
      fileName: await this.getActiveDisplayName(file),
    };
  }

  async getPreview(fileId: number, size?: StorageImagePreviewSize) {
    const file = await this.ownerStorage.findActiveFile(fileId);

    if (!isPdfStorageFile(file) && !isImageStorageFile(file)) {
      throw new BadRequestException(
        '\u041f\u0440\u0435\u0432\u044c\u044e \u0434\u043e\u0441\u0442\u0443\u043f\u043d\u043e \u0442\u043e\u043b\u044c\u043a\u043e \u0434\u043b\u044f PDF \u0438 \u0438\u0437\u043e\u0431\u0440\u0430\u0436\u0435\u043d\u0438\u0439.',
      );
    }

    const object =
      size && isImageStorageFile(file)
        ? await this.imagePreviewStorage.getPreview(file, size)
        : await this.objectStorage.getObject(file.objectKey);

    return {
      body: object.body,
      contentLength: object.contentLength,
      contentType:
        size && isImageStorageFile(file)
          ? 'image/webp'
          : isPdfStorageFile(file)
            ? 'application/pdf'
            : file.mimeType,
      fileName: await this.getActiveDisplayName(file),
      isOptimizedImagePreview: Boolean(size && isImageStorageFile(file)),
    };
  }

  async setPrimaryFileById(params: { fileId: number; userId?: string | null }) {
    return this.primaryStorage.setPrimaryFileById(params.fileId);
  }

  async softDeleteFile(params: {
    audit: StorageAuditContext;
    fileId: number;
    owner: StorageOwnerContext;
    userId?: string | null;
  }) {
    const file = await this.ownerStorage.findActiveFileForOwner(
      params.fileId,
      params.owner,
    );
    const activeFiles = await this.ownerStorage.findActiveFiles(params.owner);
    const displayName = toStorageFileDisplayNameInList(file, activeFiles);

    const deletedFile = await this.prisma.$transaction(async (tx) => {
      const nextDeletedFile = await tx.storageFile.update({
        data: {
          deletedAt: new Date(),
        },
        where: {
          id: file.id,
        },
      });

      await this.primaryStorage.assignNextPrimaryAfterDelete(tx, file);

      return nextDeletedFile;
    });

    await this.writeAudit({
      action: AuditAction.FILE_DELETE,
      audit: params.audit,
      newValue: null,
      oldValue: displayName,
      userId: params.userId,
    });

    return toStorageFileDto(deletedFile);
  }

  async softDeleteFileById(params: { fileId: number; userId?: string | null }) {
    const file = await this.ownerStorage.findActiveFile(params.fileId);

    return this.softDeleteFile({
      audit: {
        actionModule: toAuditModule(file.ownerModule),
        entityId: file.ownerEntityId,
        entityType: file.ownerEntityType,
      },
      fileId: file.id,
      owner: {
        entityId: file.ownerEntityId,
        entityType: file.ownerEntityType,
        module: file.ownerModule,
      },
      userId: params.userId,
    });
  }

  private writeAudit(params: {
    action: AuditAction;
    audit: StorageAuditContext;
    newValue: string | null;
    oldValue: string | null;
    userId?: string | null;
  }) {
    return this.auditLog.writeFieldChanges({
      action: params.action,
      entityId: params.audit.entityId,
      entityType: params.audit.entityType,
      fields: [
        {
          fieldName: '\u0424\u0430\u0439\u043b',
          newValue: params.newValue,
          oldValue: params.oldValue,
        },
      ],
      module: params.audit.actionModule,
      userId: params.userId,
    });
  }

  private async getActiveDisplayName(file: StorageFile) {
    const activeFiles = await this.ownerStorage.findActiveFiles({
      entityId: file.ownerEntityId,
      entityType: file.ownerEntityType,
      module: file.ownerModule,
    });

    return toStorageFileDisplayNameInList(file, activeFiles);
  }
}
