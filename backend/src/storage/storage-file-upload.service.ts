import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { StorageFile } from '@prisma/client';
import { AuditAction, StorageDocumentType } from '@prisma/client';
import { AuditLogService } from '../audit/audit-log.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  toStorageFileDisplayNameInList,
  toStorageFileDto,
} from './storage-file.mapper';
import {
  createStorageObjectKey,
  getSafeExtension,
  normalizeOriginalFileName,
} from './storage-file-names.helper';
import {
  assertStorageFileMatchesDocumentType,
  assertValidStorageDocumentType,
  assertValidStorageFile,
  createStorageFileBadRequest,
  isSingleStorageDocumentType,
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
export class StorageFileUploadService {
  private readonly logger = new Logger(StorageFileUploadService.name);

  constructor(
    private readonly auditLog: AuditLogService,
    private readonly objectStorage: StorageObjectService,
    private readonly ownerStorage: StorageOwnerService,
    private readonly prisma: PrismaService,
  ) {}

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
    await assertStorageFileMatchesDocumentType({
      documentType: params.documentType,
      file,
    });

    const storedObject = await this.putObjectSafely({
      body: file.buffer,
      contentType: file.mimetype,
      key: createStorageObjectKey({
        documentType: params.documentType,
        extension: getSafeExtension(file),
        owner: params.owner,
      }),
    });

    const storageFile = await this.createStorageFileSafely({
      file,
      owner: params.owner,
      storedObject,
      userId: params.userId,
      documentType: params.documentType,
    });
    const activeFiles = await this.ownerStorage.findActiveFiles(params.owner);
    const displayName = toStorageFileDisplayNameInList(
      storageFile,
      activeFiles,
    );

    await this.writeAuditBestEffort({
      action: AuditAction.FILE_UPLOAD,
      audit: params.audit,
      newValue: displayName,
      oldValue: null,
      userId: params.userId,
    });

    return toStorageFileDto(storageFile, displayName);
  }

  private async createStorageFileSafely(params: {
    documentType: StorageDocumentType;
    file: UploadedFileInput;
    owner: StorageOwnerContext;
    storedObject: { bucket: string; key: string };
    userId?: string | null;
  }) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        await this.lockOwnerFiles(tx, params.owner);
        const activeFilesBeforeUpload = await this.findActiveOwnerFiles(
          tx,
          params.owner,
        );

        this.assertDocumentCanBeAdded({
          activeFiles: activeFilesBeforeUpload,
          documentType: params.documentType,
        });

        return tx.storageFile.create({
          data: {
            bucket: params.storedObject.bucket,
            documentType: params.documentType,
            isPrimary: this.shouldMakePrimary({
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
      });
    } catch (error) {
      await this.objectStorage
        .deleteObject(params.storedObject.key)
        .catch(() => null);

      if (error instanceof BadRequestException) {
        throw error;
      }

      this.logger.error(
        `Failed to save uploaded file metadata: ${params.storedObject.key}`,
        error instanceof Error ? error.stack : String(error),
      );

      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        throw new InternalServerErrorException({
          code: 'DATABASE_ERROR',
          message:
            'Файл загружен, но не удалось сохранить сведения о документе.',
        });
      }

      throw new InternalServerErrorException({
        code: 'UPLOAD_FAILED',
        message: 'Не удалось завершить загрузку. Изменения отменены.',
      });
    }
  }

  private assertDocumentCanBeAdded(params: {
    activeFiles: StorageFile[];
    documentType: StorageDocumentType;
  }) {
    if (!isSingleStorageDocumentType(params.documentType)) {
      return;
    }

    const hasActiveDocument = params.activeFiles.some(
      (file) => file.documentType === params.documentType,
    );

    if (hasActiveDocument) {
      throw createStorageFileBadRequest(
        'DOCUMENT_ALREADY_EXISTS',
        'Паспорт для этого оборудования уже загружен. Удалите его перед загрузкой нового.',
      );
    }
  }

  private shouldMakePrimary(params: {
    activeFiles: StorageFile[];
    documentType: StorageDocumentType;
  }) {
    if (params.documentType !== StorageDocumentType.equipment_photo) {
      return false;
    }

    return !params.activeFiles.some(
      (file) => file.documentType === StorageDocumentType.equipment_photo,
    );
  }

  private async putObjectSafely(input: {
    body: Buffer;
    contentType?: string;
    key: string;
  }) {
    try {
      return await this.objectStorage.putObject(input);
    } catch (error) {
      this.logger.error(
        `Failed to upload file to object storage: ${input.key}`,
        error instanceof Error ? error.stack : String(error),
      );

      throw new ServiceUnavailableException({
        code: 'STORAGE_UNAVAILABLE',
        message: 'Хранилище файлов временно недоступно.',
      });
    }
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

  private lockOwnerFiles(
    tx: Prisma.TransactionClient,
    owner: StorageOwnerContext,
  ) {
    return tx.$executeRaw`
      SELECT pg_advisory_xact_lock(hashtext(${this.getOwnerLockKey(owner)}))
    `;
  }

  private getOwnerLockKey(owner: StorageOwnerContext) {
    return [
      'storage_files',
      owner.module,
      owner.entityType,
      owner.entityId,
    ].join(':');
  }

  private async writeAuditBestEffort(params: {
    action: AuditAction;
    audit: StorageAuditContext;
    newValue: string | null;
    oldValue: string | null;
    userId?: string | null;
  }) {
    try {
      await this.writeAudit(params);
    } catch (error) {
      this.logger.error(
        'Failed to write storage file audit log',
        error instanceof Error ? error.stack : String(error),
      );
    }
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
          fieldName: 'Файл',
          newValue: params.newValue,
          oldValue: params.oldValue,
        },
      ],
      module: params.audit.actionModule,
      userId: params.userId,
    });
  }
}
