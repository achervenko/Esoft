import { BadRequestException } from '@nestjs/common';
import { StorageDocumentType } from '@prisma/client';
import {
  getExtensionByMimeType,
  getExtensionFromName,
} from './storage-file-names.helper';
import type { UploadedFileInput } from './storage.types';

export const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024;

const singleDocumentTypes = new Set<StorageDocumentType>([
  StorageDocumentType.passport,
]);

export function assertValidStorageFile(file: UploadedFileInput) {
  if (!file) {
    throwStorageFileBadRequest(
      'FILE_REQUIRED',
      '\u0412\u044b\u0431\u0435\u0440\u0438\u0442\u0435 \u0444\u0430\u0439\u043b \u0434\u043b\u044f \u0437\u0430\u0433\u0440\u0443\u0437\u043a\u0438.',
    );
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    throwStorageFileBadRequest(
      'FILE_TOO_LARGE',
      '\u0420\u0430\u0437\u043c\u0435\u0440 \u0444\u0430\u0439\u043b\u0430 \u043d\u0435 \u0434\u043e\u043b\u0436\u0435\u043d \u043f\u0440\u0435\u0432\u044b\u0448\u0430\u0442\u044c 25 \u041c\u0411.',
    );
  }

  if (!file.buffer || file.size <= 0) {
    throwStorageFileBadRequest(
      'EMPTY_FILE',
      '\u0424\u0430\u0439\u043b \u043f\u0443\u0441\u0442\u043e\u0439 \u0438\u043b\u0438 \u043d\u0435 \u043f\u0435\u0440\u0435\u0434\u0430\u043d.',
    );
  }

  if (!file.originalname?.trim()) {
    throwStorageFileBadRequest(
      'UNSUPPORTED_FILE_FORMAT',
      '\u0418\u043c\u044f \u0444\u0430\u0439\u043b\u0430 \u043f\u0443\u0441\u0442\u043e\u0435 \u0438\u043b\u0438 \u0444\u0430\u0439\u043b \u043d\u0435 \u0443\u0434\u0430\u0451\u0442\u0441\u044f \u043f\u0440\u043e\u0447\u0438\u0442\u0430\u0442\u044c.',
    );
  }
}

export function assertValidStorageDocumentType(
  documentType: unknown,
): asserts documentType is StorageDocumentType {
  if (!documentType) {
    throwStorageFileBadRequest(
      'DOCUMENT_TYPE_REQUIRED',
      '\u0412\u044b\u0431\u0435\u0440\u0438\u0442\u0435 \u0442\u0438\u043f \u0434\u043e\u043a\u0443\u043c\u0435\u043d\u0442\u0430.',
    );
  }

  if (!isStorageDocumentType(documentType)) {
    throwStorageFileBadRequest(
      'UNSUPPORTED_DOCUMENT_TYPE',
      '\u041d\u0435\u043a\u043e\u0440\u0440\u0435\u043a\u0442\u043d\u044b\u0439 \u0442\u0438\u043f \u0434\u043e\u043a\u0443\u043c\u0435\u043d\u0442\u0430.',
    );
  }
}

export function assertStorageFileMatchesDocumentType(params: {
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
      '\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u043e\u043f\u0440\u0435\u0434\u0435\u043b\u0438\u0442\u044c \u0444\u043e\u0440\u043c\u0430\u0442 \u0444\u0430\u0439\u043b\u0430.',
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
          ? '\u0414\u043b\u044f \u043f\u0430\u0441\u043f\u043e\u0440\u0442\u0430 \u0434\u043e\u0441\u0442\u0443\u043f\u0435\u043d \u0442\u043e\u043b\u044c\u043a\u043e \u0444\u043e\u0440\u043c\u0430\u0442 PDF.'
          : '\u0414\u043b\u044f \u0438\u043d\u0441\u0442\u0440\u0443\u043a\u0446\u0438\u0438 \u043f\u043e \u043e\u0431\u0441\u043b\u0443\u0436\u0438\u0432\u0430\u043d\u0438\u044e \u0434\u043e\u0441\u0442\u0443\u043f\u0435\u043d \u0442\u043e\u043b\u044c\u043a\u043e \u0444\u043e\u0440\u043c\u0430\u0442 PDF.',
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
      !allowedImageExtensions.has(effectiveExtension)
    ) {
      throwStorageFileBadRequest(
        'UNSUPPORTED_FILE_FORMAT',
        '\u0414\u043b\u044f \u0444\u043e\u0442\u043e\u0433\u0440\u0430\u0444\u0438\u0438 \u0434\u043e\u0441\u0442\u0443\u043f\u043d\u044b JPG, PNG \u0438 WebP.',
      );
    }

    assertValidImageBuffer({
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
  if (buffer.subarray(0, 5).toString('ascii') !== '%PDF-') {
    throwStorageFileBadRequest(
      'INVALID_PDF',
      '\u0424\u0430\u0439\u043b PDF \u043f\u043e\u0432\u0440\u0435\u0436\u0434\u0451\u043d \u0438\u043b\u0438 \u0438\u043c\u0435\u0435\u0442 \u043d\u0435\u0432\u0435\u0440\u043d\u044b\u0439 \u0444\u043e\u0440\u043c\u0430\u0442.',
    );
  }
}

function assertValidImageBuffer(params: { buffer: Buffer; mimeType: string }) {
  const isJpeg =
    params.mimeType === 'image/jpeg' &&
    params.buffer[0] === 0xff &&
    params.buffer[1] === 0xd8 &&
    params.buffer[2] === 0xff;
  const isPng =
    params.mimeType === 'image/png' &&
    params.buffer.subarray(0, 8).equals(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    );
  const isWebp =
    params.mimeType === 'image/webp' &&
    params.buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    params.buffer.subarray(8, 12).toString('ascii') === 'WEBP';

  if (!isJpeg && !isPng && !isWebp) {
    throwStorageFileBadRequest(
      'INVALID_IMAGE',
      '\u0418\u0437\u043e\u0431\u0440\u0430\u0436\u0435\u043d\u0438\u0435 \u043f\u043e\u0432\u0440\u0435\u0436\u0434\u0435\u043d\u043e \u0438\u043b\u0438 \u0438\u043c\u0435\u0435\u0442 \u043d\u0435\u0432\u0435\u0440\u043d\u044b\u0439 \u0444\u043e\u0440\u043c\u0430\u0442.',
    );
  }
}

function throwStorageFileBadRequest(code: string, message: string): never {
  throw createStorageFileBadRequest(code, message);
}
