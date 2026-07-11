import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  Injectable,
} from '@nestjs/common';
import type { StorageFile } from '@prisma/client';
import { AuditAction, AuditModule, StorageOwnerModule } from '@prisma/client';
import { AuditLogService } from '../audit/audit-log.service';
import { PrismaService } from '../prisma/prisma.service';
import { StorageObjectService } from './storage-object.service';
import { StorageOwnerService } from './storage-owner.service';
import type {
  StorageAuditContext,
  StorageFileDto,
  StorageOwnerContext,
  UploadedFileInput,
} from './storage.types';

const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024;

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
    file: UploadedFileInput;
    owner: StorageOwnerContext;
    userId?: string | null;
  }): Promise<StorageFileDto> {
    this.assertValidFile(params.file);

    const objectKey = this.createObjectKey(params.owner, params.file.originalname);
    const storedObject = await this.objectStorage.putObject({
      body: params.file.buffer,
      contentType: params.file.mimetype,
      key: objectKey,
    });

    let storageFile: StorageFile;

    try {
      storageFile = await this.prisma.storageFile.create({
        data: {
          bucket: storedObject.bucket,
          mimeType: params.file.mimetype || 'application/octet-stream',
          objectKey: storedObject.key,
          originalName: params.file.originalname,
          ownerEntityId: params.owner.entityId,
          ownerEntityType: params.owner.entityType,
          ownerModule: params.owner.module,
          sizeBytes: BigInt(params.file.size),
          uploadedByUserId: params.userId ?? null,
        },
      });
    } catch (error) {
      await this.objectStorage.deleteObject(storedObject.key).catch(() => null);
      throw error;
    }

    await this.auditLog.writeFieldChanges({
      action: AuditAction.FILE_UPLOAD,
      entityId: params.audit.entityId,
      entityType: params.audit.entityType,
      fields: [
        {
          fieldName: 'Файл',
          newValue: storageFile.originalName,
        },
      ],
      module: params.audit.actionModule,
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
      fileName: file.originalName,
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

    await this.auditLog.writeFieldChanges({
      action: AuditAction.FILE_DELETE,
      entityId: params.audit.entityId,
      entityType: params.audit.entityType,
      fields: [
        {
          fieldName: 'Файл',
          oldValue: file.originalName,
          newValue: null,
        },
      ],
      module: params.audit.actionModule,
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

  private assertValidFile(file: UploadedFileInput) {
    if (!file?.buffer || file.size <= 0) {
      throw new BadRequestException('Файл пустой или не передан.');
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      throw new BadRequestException('Размер файла не должен превышать 25 МБ.');
    }
  }

  private createObjectKey(owner: StorageOwnerContext, originalName: string) {
    const safeFileName = toSafeFileName(originalName);
    return `${owner.module}/${owner.entityId}/${randomUUID()}-${safeFileName}`;
  }
}

function toAuditModule(module: StorageOwnerModule) {
  const modules: Record<StorageOwnerModule, AuditModule> = {
    [StorageOwnerModule.EQUIPMENT]: AuditModule.EQUIPMENT,
  };

  return modules[module];
}

function toStorageFileDto(file: StorageFile): StorageFileDto {
  return {
    createdAt: file.createdAt,
    deletedAt: file.deletedAt,
    id: file.id,
    mimeType: file.mimeType,
    originalName: file.originalName,
    sizeBytes: file.sizeBytes.toString(),
  };
}

function toSafeFileName(fileName: string) {
  const cleanName = fileName
    .trim()
    .replace(/[\\/]/g, '-')
    .replace(/[^\p{L}\p{N}._ -]/gu, '')
    .replace(/\s+/g, '-');

  if (!cleanName || cleanName === '.' || cleanName === '..') {
    throw new BadRequestException('Некорректное имя файла.');
  }

  return cleanName.slice(0, 160);
}
