import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import { StorageDocumentType } from '@prisma/client';
import {
  createStorageObjectKey,
  getSafeExtension,
  normalizeOriginalFileName,
} from './storage-file-names.helper';
import { StorageFileUploadTransactionService } from './storage-file-upload-transaction.service';
import {
  assertValidStorageDocumentType,
  assertValidStorageFile,
} from './storage-file.validation';
import { toStorageFileDto } from './storage-file.mapper';
import { StorageObjectService } from './storage-object.service';
import { StorageFilePolicyService } from './storage-file-policy.service';
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
    private readonly policy: StorageFilePolicyService,
    private readonly transactionStorage: StorageFileUploadTransactionService,
  ) {}

  async uploadFile(params: {
    audit: StorageAuditContext;
    documentType: StorageDocumentType;
    file: UploadedFileInput | undefined;
    owner: StorageOwnerContext;
    requestKey?: string;
    userId: string;
  }): Promise<StorageFileDto> {
    const file = normalizeUploadedFileInput(params.file);

    assertValidStorageFile(file);
    assertValidStorageDocumentType(params.documentType);
    const sha256 = createHash('sha256').update(file.buffer).digest('hex');
    const request = params.requestKey
      ? {
          key: params.requestKey,
          hash: createHash('sha256')
            .update(
              JSON.stringify([
                params.documentType,
                file.originalname,
                file.mimetype,
                params.userId ?? null,
              ]),
            )
            .update(file.buffer)
            .digest('hex'),
        }
      : undefined;
    if (request) {
      const replay = await this.transactionStorage.findUploadReplay(
        params.owner,
        request,
      );
      if (replay)
        return toStorageFileDto(replay.storageFile, replay.displayName);
    }
    await this.policy.assertFileMatchesDocumentType({
      documentType: params.documentType,
      file,
    });

    const key = createStorageObjectKey({
      documentType: params.documentType,
      extension: getSafeExtension(file),
      owner: params.owner,
    });
    const pendingUploadId = await this.transactionStorage.trackUpload({
      ...params,
      file,
      sha256,
      storedObject: { bucket: this.objectStorage.bucket, key },
    });
    const storedObject = await this.putObjectSafely({
      body: file.buffer,
      contentType: file.mimetype,
      key,
    });

    try {
      const result = await this.transactionStorage.createStorageFile({
        audit: params.audit,
        documentType: params.documentType,
        file,
        owner: params.owner,
        ...(request ? { request } : {}),
        storedObject,
        pendingUploadId,
        userId: params.userId,
      });

      return toStorageFileDto(result.storageFile, result.displayName);
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof ConflictException
      ) {
        throw error;
      }

      if (request) {
        const replay = await this.transactionStorage
          .findUploadReplay(params.owner, request)
          .catch((lookupError: unknown) => {
            if (lookupError instanceof ConflictException) throw lookupError;
            return null;
          });
        if (replay)
          return toStorageFileDto(replay.storageFile, replay.displayName);
      }
      this.logger.error(
        `Failed to save uploaded file metadata: ${storedObject.key}`,
        error instanceof Error ? error.stack : String(error),
      );

      throw new ServiceUnavailableException({
        code: 'STORAGE_UPLOAD_RESULT_UNKNOWN',
        message: 'Не удалось подтвердить результат загрузки. Повторите запрос.',
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
}

function normalizeUploadedFileInput(
  file: UploadedFileInput | undefined,
): UploadedFileInput | undefined {
  if (!file) {
    return undefined;
  }

  const inputBuffer: unknown = file.buffer;
  const buffer = Buffer.isBuffer(inputBuffer)
    ? inputBuffer
    : inputBuffer instanceof Uint8Array
      ? Buffer.from(inputBuffer)
      : Buffer.alloc(0);

  return {
    ...file,
    buffer,
    originalname: normalizeOriginalFileName(file.originalname ?? ''),
    size: buffer.length,
  };
}
