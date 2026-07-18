import { BadRequestException } from '@nestjs/common';
import { StorageDocumentType } from '@prisma/client';
import sharp from 'sharp';
import {
  getExtensionByMimeType,
  getExtensionFromName,
} from './storage-file-names.helper';
import type { UploadedFileInput } from './storage.types';

export const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024;
const MAX_IMAGE_PIXEL_COUNT = 120_000_000;

const singleDocumentTypes = new Set<StorageDocumentType>([
  StorageDocumentType.passport,
]);

export function assertValidStorageFile(file: UploadedFileInput) {
  if (!file) {
    throwStorageFileBadRequest('FILE_REQUIRED', 'Выберите файл для загрузки.');
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    throwStorageFileBadRequest(
      'FILE_TOO_LARGE',
      'Размер файла не должен превышать 25 МБ.',
    );
  }

  if (!file.buffer || file.size <= 0) {
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

export async function assertStorageFileMatchesDocumentType(params: {
  documentType: StorageDocumentType;
  file: UploadedFileInput;
}) {
  const extension = getExtensionFromName(params.file.originalname);
  const extensionByMimeType = getExtensionByMimeType(params.file.mimetype);
  const effectiveExtension = extension ?? extensionByMimeType;
  const mimeType = params.file.mimetype?.toLowerCase() ?? '';

  if (!effectiveExtension) {
    throwStorageFileBadRequest(
      'UNSUPPORTED_FILE_FORMAT',
      'Не удалось определить формат файла.',
    );
  }

  if (
    params.documentType === StorageDocumentType.passport ||
    params.documentType === StorageDocumentType.maintenance_instruction
  ) {
    if (mimeType !== 'application/pdf' || effectiveExtension !== 'pdf') {
      throwStorageFileBadRequest(
        'UNSUPPORTED_FILE_FORMAT',
        params.documentType === StorageDocumentType.passport
          ? 'Для паспорта доступен только формат PDF.'
          : 'Для инструкции по обслуживанию доступен только формат PDF.',
      );
    }

    assertValidPdfBuffer(params.file.buffer);
  }

  if (params.documentType === StorageDocumentType.equipment_photo) {
    const allowedImageMimeTypes = new Set([
      'image/jpeg',
      'image/png',
      'image/webp',
    ]);
    const allowedImageExtensions = new Set(['jpg', 'jpeg', 'png', 'webp']);

    if (
      !allowedImageMimeTypes.has(mimeType) ||
      !effectiveExtension ||
      !allowedImageExtensions.has(effectiveExtension) ||
      !imageExtensionMatchesMimeType(effectiveExtension, mimeType)
    ) {
      throwStorageFileBadRequest(
        'UNSUPPORTED_FILE_FORMAT',
        'Для фотографии доступны JPG, PNG и WebP.',
      );
    }

    await assertValidImageBuffer({
      buffer: params.file.buffer,
      mimeType,
    });
  }
}

export function isSingleStorageDocumentType(documentType: StorageDocumentType) {
  return singleDocumentTypes.has(documentType);
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

function assertValidPdfBuffer(buffer: Buffer) {
  if (
    buffer.subarray(0, 5).toString('ascii') !== '%PDF-' ||
    buffer.lastIndexOf(Buffer.from('%%EOF', 'ascii')) === -1
  ) {
    throwStorageFileBadRequest(
      'INVALID_PDF',
      'Файл PDF повреждён или имеет неверный формат.',
    );
  }
}

async function assertValidImageBuffer(params: {
  buffer: Buffer;
  mimeType: string;
}) {
  const isJpeg =
    params.mimeType === 'image/jpeg' &&
    params.buffer[0] === 0xff &&
    params.buffer[1] === 0xd8 &&
    params.buffer[2] === 0xff;
  const isPng =
    params.mimeType === 'image/png' &&
    params.buffer
      .subarray(0, 8)
      .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  const isWebp =
    params.mimeType === 'image/webp' &&
    params.buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    params.buffer.subarray(8, 12).toString('ascii') === 'WEBP';

  if (!isJpeg && !isPng && !isWebp) {
    throwStorageFileBadRequest(
      'INVALID_IMAGE',
      'Изображение повреждено или имеет неверный формат.',
    );
  }

  try {
    await sharp(params.buffer, { limitInputPixels: MAX_IMAGE_PIXEL_COUNT })
      .rotate()
      .toBuffer();
  } catch {
    throwStorageFileBadRequest(
      'INVALID_IMAGE',
      'Изображение повреждено или имеет неверный формат.',
    );
  }
}

function throwStorageFileBadRequest(code: string, message: string): never {
  throw createStorageFileBadRequest(code, message);
}

function imageExtensionMatchesMimeType(extension: string, mimeType: string) {
  if (mimeType === 'image/jpeg') {
    return extension === 'jpg' || extension === 'jpeg';
  }

  return getExtensionByMimeType(mimeType) === extension;
}
