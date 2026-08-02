import { BadRequestException } from '@nestjs/common';
import { StorageDocumentType } from '@prisma/client';
import type { UploadedFileInput } from './storage.types';

export const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024;

export function assertValidStorageFile(
  file: UploadedFileInput | undefined,
): asserts file is UploadedFileInput {
  if (!file) {
    throwStorageFileBadRequest('FILE_REQUIRED', 'Выберите файл для загрузки.');
  }

  const fileSize = file.buffer?.length ?? 0;

  if (fileSize > MAX_FILE_SIZE_BYTES) {
    throwStorageFileBadRequest(
      'FILE_TOO_LARGE',
      'Размер файла не должен превышать 25 МБ.',
    );
  }

  if (fileSize <= 0) {
    throwStorageFileBadRequest('EMPTY_FILE', 'Файл пустой или не передан.');
  }

  if (!file.originalname?.trim()) {
    throwStorageFileBadRequest(
      'UNSUPPORTED_FILE_FORMAT',
      'Имя файла пустое или файл не удаётся прочитать.',
    );
  }
}

export function assertValidStorageDocumentType(
  documentType: unknown,
): asserts documentType is StorageDocumentType {
  if (!documentType) {
    throwStorageFileBadRequest(
      'DOCUMENT_TYPE_REQUIRED',
      'Выберите тип документа.',
    );
  }

  if (!isStorageDocumentType(documentType)) {
    throwStorageFileBadRequest(
      'UNSUPPORTED_DOCUMENT_TYPE',
      'Некорректный тип документа.',
    );
  }
}

export function createStorageFileBadRequest(code: string, message: string) {
  return new BadRequestException({ code, message });
}

function isStorageDocumentType(value: unknown): value is StorageDocumentType {
  return (
    typeof value === 'string' &&
    (Object.values(StorageDocumentType) as string[]).includes(value)
  );
}

function throwStorageFileBadRequest(code: string, message: string): never {
  throw createStorageFileBadRequest(code, message);
}
