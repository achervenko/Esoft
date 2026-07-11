import {
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
import { toStorageFileDisplayNameInList, toStorageFileDto } from './storage-file.mapper';
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
    assertStorageFileMatchesDocumentType({
      documentType: params.documentType,
      file,
    });

    const activeFilesBeforeUpload = await this.ownerStorage.findActiveFiles(
      params.owner,
    );
    this.assertDocumentCanBeAdded({
      activeFiles: activeFilesBeforeUpload,
      documentType: params.documentType,
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

    await this.writeAudit({
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
      return await this.prisma.storageFile.create({
        data: {
          bucket: params.storedObject.bucket,
          documentType: params.documentType,
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
    } catch (error) {
      await this.objectStorage
        .deleteObject(params.storedObject.key)
        .catch(() => null);
      this.logger.error(
        `Failed to save uploaded file metadata: ${params.storedObject.key}`,
        error instanceof Error ? error.stack : String(error),
      );

      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        throw new InternalServerErrorException({
          code: 'DATABASE_ERROR',
          message:
            '\u0424\u0430\u0439\u043b \u0437\u0430\u0433\u0440\u0443\u0436\u0435\u043d, \u043d\u043e \u043d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0441\u043e\u0445\u0440\u0430\u043d\u0438\u0442\u044c \u0441\u0432\u0435\u0434\u0435\u043d\u0438\u044f \u043e \u0434\u043e\u043a\u0443\u043c\u0435\u043d\u0442\u0435.',
        });
      }

      throw new InternalServerErrorException({
        code: 'UPLOAD_FAILED',
        message:
          '\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0437\u0430\u0432\u0435\u0440\u0448\u0438\u0442\u044c \u0437\u0430\u0433\u0440\u0443\u0437\u043a\u0443. \u0418\u0437\u043c\u0435\u043d\u0435\u043d\u0438\u044f \u043e\u0442\u043c\u0435\u043d\u0435\u043d\u044b.',
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
        '\u041f\u0430\u0441\u043f\u043e\u0440\u0442 \u0434\u043b\u044f \u044d\u0442\u043e\u0433\u043e \u043e\u0431\u043e\u0440\u0443\u0434\u043e\u0432\u0430\u043d\u0438\u044f \u0443\u0436\u0435 \u0437\u0430\u0433\u0440\u0443\u0436\u0435\u043d. \u0423\u0434\u0430\u043b\u0438\u0442\u0435 \u0435\u0433\u043e \u043f\u0435\u0440\u0435\u0434 \u0437\u0430\u0433\u0440\u0443\u0437\u043a\u043e\u0439 \u043d\u043e\u0432\u043e\u0433\u043e.',
      );
    }
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
        message:
          '\u0425\u0440\u0430\u043d\u0438\u043b\u0438\u0449\u0435 \u0444\u0430\u0439\u043b\u043e\u0432 \u0432\u0440\u0435\u043c\u0435\u043d\u043d\u043e \u043d\u0435\u0434\u043e\u0441\u0442\u0443\u043f\u043d\u043e.',
      });
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
