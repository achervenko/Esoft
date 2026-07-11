import { BadRequestException, Injectable } from '@nestjs/common';
import type { StorageFile } from '@prisma/client';
import { AuditAction, StorageDocumentType } from '@prisma/client';
import { AuditLogService } from '../audit/audit-log.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  toAuditModule,
  toStorageFileDisplayName,
  toStorageFileDto,
} from './storage-file.mapper';
import {
  createStorageObjectKey,
  getSafeExtension,
  isPdfStorageFile,
  normalizeOriginalFileName,
} from './storage-file-names.helper';
import {
  assertValidStorageDocumentType,
  assertValidStorageFile,
} from './storage-file.validation';
import { StorageObjectService } from './storage-object.service';
import { StorageOwnerService } from './storage-owner.service';
import type {
  StorageAuditContext,
  StorageFileDto,
  StorageOwnerContext,
  UploadedFileInput,
} from './storage.types';

@Injectable()
export class StorageFileService {
  constructor(
    private readonly auditLog: AuditLogService,
    private readonly objectStorage: StorageObjectService,
    private readonly ownerStorage: StorageOwnerService,
    private readonly prisma: PrismaService,
  ) {}

  async listFiles(owner: StorageOwnerContext): Promise<StorageFileDto[]> {
    const files = await this.ownerStorage.findActiveFiles(owner);
    return files.map(toStorageFileDto);
  }

  async uploadFile(params: {
    audit: StorageAuditContext;
    documentType: StorageDocumentType;
    file: UploadedFileInput;
    owner: StorageOwnerContext;
    userId?: string | null;
  }): Promise<StorageFileDto> {
    assertValidStorageFile(params.file);
    assertValidStorageDocumentType(params.documentType);

    const file = {
      ...params.file,
      originalname: normalizeOriginalFileName(params.file.originalname),
    };
    const storedObject = await this.objectStorage.putObject({
      body: file.buffer,
      contentType: file.mimetype,
      key: createStorageObjectKey({
        documentType: params.documentType,
        extension: getSafeExtension(file),
        owner: params.owner,
      }),
    });

    let storageFile: StorageFile;

    try {
      storageFile = await this.prisma.storageFile.create({
        data: {
          bucket: storedObject.bucket,
          documentType: params.documentType,
          mimeType: file.mimetype || 'application/octet-stream',
          objectKey: storedObject.key,
          originalName: file.originalname,
          ownerEntityId: params.owner.entityId,
          ownerEntityType: params.owner.entityType,
          ownerModule: params.owner.module,
          sizeBytes: BigInt(file.size),
          uploadedByUserId: params.userId ?? null,
        },
      });
    } catch (error) {
      await this.objectStorage.deleteObject(storedObject.key).catch(() => null);
      throw error;
    }

    await this.writeAudit({
      action: AuditAction.FILE_UPLOAD,
      audit: params.audit,
      newValue: toStorageFileDisplayName(storageFile),
      oldValue: null,
      userId: params.userId,
    });

    return toStorageFileDto(storageFile);
  }

  async getDownload(fileId: number) {
    const file = await this.ownerStorage.findActiveFile(fileId);
    const object = await this.objectStorage.getObject(file.objectKey);

    return {
      body: object.body,
      contentLength: object.contentLength,
      contentType: object.contentType || file.mimeType,
      fileName: toStorageFileDisplayName(file),
    };
  }

  async getPreview(fileId: number) {
    const file = await this.ownerStorage.findActiveFile(fileId);

    if (!isPdfStorageFile(file)) {
      throw new BadRequestException(
        '\u041f\u0440\u0435\u0432\u044c\u044e \u0434\u043e\u0441\u0442\u0443\u043f\u043d\u043e \u0442\u043e\u043b\u044c\u043a\u043e \u0434\u043b\u044f PDF-\u0444\u0430\u0439\u043b\u043e\u0432.',
      );
    }

    const object = await this.objectStorage.getObject(file.objectKey);

    return {
      body: object.body,
      contentLength: object.contentLength,
      contentType: 'application/pdf',
      fileName: toStorageFileDisplayName(file),
    };
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

    const deletedFile = await this.prisma.storageFile.update({
      data: {
        deletedAt: new Date(),
      },
      where: {
        id: file.id,
      },
    });

    await this.writeAudit({
      action: AuditAction.FILE_DELETE,
      audit: params.audit,
      newValue: null,
      oldValue: toStorageFileDisplayName(file),
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
}
