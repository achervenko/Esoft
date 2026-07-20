import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Prisma, StorageDocumentType } from '@prisma/client';
import {
  createStorageObjectKey,
  getSafeExtension,
  normalizeOriginalFileName,
} from './storage-file-names.helper';
import { StorageFileUploadTransactionService } from './storage-file-upload-transaction.service';
import {
  assertStorageFileMatchesDocumentType,
  assertValidStorageDocumentType,
  assertValidStorageFile,
} from './storage-file.validation';
import { toStorageFileDto } from './storage-file.mapper';
import { StorageObjectService } from './storage-object.service';
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
    private readonly objectStorage: StorageObjectService,
    private readonly transactionStorage: StorageFileUploadTransactionService,
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

    try {
      const result = await this.transactionStorage.createStorageFile({
        audit: params.audit,
        documentType: params.documentType,
        file,
        owner: params.owner,
        storedObject,
        userId: params.userId,
      });

      return toStorageFileDto(result.storageFile, result.displayName);
    } catch (error) {
      await this.deleteUploadedObjectAfterFailure(storedObject.key);

      if (error instanceof BadRequestException) {
        throw error;
      }

      this.logger.error(
        `Failed to save uploaded file metadata: ${storedObject.key}`,
        error instanceof Error ? error.stack : String(error),
      );

      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        throw new InternalServerErrorException({
          code: 'DATABASE_ERROR',
          message:
            'Не удалось сохранить сведения о документе. Загрузка отменена.',
        });
      }

      throw new InternalServerErrorException({
        code: 'UPLOAD_FAILED',
        message: 'Не удалось завершить загрузку. Изменения отменены.',
      });
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
        message: 'Хранилище файлов временно недоступно.',
      });
    }
  }

  private async deleteUploadedObjectAfterFailure(key: string) {
    try {
      await this.objectStorage.deleteObject(key);
    } catch (cleanupError) {
      this.logger.error(
        `Failed to remove orphaned storage object: ${key}`,
        cleanupError instanceof Error
          ? cleanupError.stack
          : String(cleanupError),
      );
    }
  }
}
