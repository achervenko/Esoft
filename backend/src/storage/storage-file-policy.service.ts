import { Inject, Injectable } from '@nestjs/common';
import type { StorageFile } from '@prisma/client';
import type { StorageDocumentType } from '@prisma/client';
import sharp from 'sharp';
import {
  getExtensionByMimeType,
  getExtensionFromName,
} from './storage-file-names.helper';
import { createStorageFileBadRequest } from './storage-file.validation';
import {
  STORAGE_FILE_POLICY_CONFIG,
  type StorageFilePolicyConfig,
  type StorageFileDocumentRule,
} from './storage-file-policy.config';
import type { UploadedFileInput } from './storage.types';

@Injectable()
export class StorageFilePolicyService {
  private readonly documentRules: Readonly<
    Partial<Record<StorageDocumentType, StorageFileDocumentRule>>
  >;
  private readonly primaryDocumentTypes: ReadonlySet<StorageDocumentType>;
  private readonly singleDocumentTypes: ReadonlySet<StorageDocumentType>;

  constructor(
    @Inject(STORAGE_FILE_POLICY_CONFIG)
    config: StorageFilePolicyConfig,
  ) {
    this.documentRules = copyDocumentRules(config.documentRules);
    this.primaryDocumentTypes = new Set(config.primaryDocumentTypes);
    this.singleDocumentTypes = new Set(config.singleDocumentTypes);
  }

  async assertFileMatchesDocumentType(params: {
    documentType: StorageDocumentType;
    file: UploadedFileInput;
  }) {
    const rule = this.documentRules[params.documentType];

    if (!rule) {
      return;
    }

    const extension = getExtensionFromName(params.file.originalname);
    const extensionByMimeType = getExtensionByMimeType(params.file.mimetype);
    const effectiveExtension = extension ?? extensionByMimeType;
    const mimeType = params.file.mimetype?.toLowerCase() ?? '';

    if (
      rule.allowedExtensions &&
      (!effectiveExtension ||
        !rule.allowedExtensions.includes(effectiveExtension))
    ) {
      throwUnsupportedFileFormat();
    }

    if (
      rule.allowedMimeTypes &&
      !rule.allowedMimeTypes
        .map((item) => item.toLowerCase())
        .includes(mimeType)
    ) {
      throwUnsupportedFileFormat();
    }

    if (
      extension &&
      extensionByMimeType &&
      !extensionMatchesMimeType(extension, mimeType) &&
      rule.allowedExtensions?.includes(extension) &&
      rule.allowedMimeTypes
        ?.map((item) => item.toLowerCase())
        .includes(mimeType)
    ) {
      throwUnsupportedFileFormat();
    }

    if (rule.validateContent === 'pdf') {
      assertValidPdfBuffer(params.file.buffer);
    }

    if (rule.validateContent === 'image') {
      assertImageMimeTypeMatchesRule({
        allowedMimeTypes: rule.allowedMimeTypes,
        buffer: params.file.buffer,
        mimeType,
      });

      await assertValidImageBuffer({
        buffer: params.file.buffer,
        maxPixelCount: rule.maxPixelCount,
      });
    }
  }

  assertDocumentCanBeAdded(params: {
    activeFiles: StorageFile[];
    documentType: StorageDocumentType;
  }) {
    if (!this.isSingleDocumentType(params.documentType)) {
      return;
    }

    const hasActiveDocument = params.activeFiles.some(
      (file) => file.documentType === params.documentType,
    );

    if (hasActiveDocument) {
      throw createStorageFileBadRequest(
        'DOCUMENT_ALREADY_EXISTS',
        'Файл этого типа уже загружен. Удалите его перед загрузкой нового.',
      );
    }
  }

  shouldMakePrimary(params: {
    activeFiles: StorageFile[];
    documentType: StorageDocumentType;
  }) {
    if (!this.canBePrimary(params.documentType)) {
      return false;
    }

    return !params.activeFiles.some(
      (file) => file.documentType === params.documentType && file.isPrimary,
    );
  }

  assertCanBePrimary(documentType: StorageDocumentType) {
    if (this.canBePrimary(documentType)) {
      return;
    }

    throw createStorageFileBadRequest(
      'UNSUPPORTED_PRIMARY_FILE',
      'Этот тип файла нельзя сделать основным.',
    );
  }

  canBePrimary(documentType: StorageDocumentType) {
    return this.primaryDocumentTypes.has(documentType);
  }

  private isSingleDocumentType(documentType: StorageDocumentType) {
    return this.singleDocumentTypes.has(documentType);
  }
}

function copyDocumentRules(
  documentRules: StorageFilePolicyConfig['documentRules'],
): Partial<Record<StorageDocumentType, StorageFileDocumentRule>> {
  return Object.fromEntries(
    Object.entries(documentRules ?? {}).map(([documentType, rule]) => [
      documentType,
      {
        ...rule,
        allowedExtensions: rule.allowedExtensions
          ? [...rule.allowedExtensions]
          : undefined,
        allowedMimeTypes: rule.allowedMimeTypes
          ? [...rule.allowedMimeTypes]
          : undefined,
      },
    ]),
  ) as Partial<Record<StorageDocumentType, StorageFileDocumentRule>>;
}

function assertValidPdfBuffer(buffer: Buffer) {
  if (
    buffer.subarray(0, 5).toString('ascii') !== '%PDF-' ||
    buffer.lastIndexOf(Buffer.from('%%EOF', 'ascii')) === -1
  ) {
    throw createStorageFileBadRequest(
      'INVALID_PDF',
      'Файл PDF повреждён или имеет неверный формат.',
    );
  }
}

function assertImageMimeTypeMatchesRule(params: {
  allowedMimeTypes?: readonly string[];
  buffer: Buffer;
  mimeType: string;
}) {
  const detectedMimeType = detectImageMimeType(params.buffer);

  if (!detectedMimeType || detectedMimeType !== params.mimeType) {
    throwUnsupportedFileFormat();
  }

  if (
    params.allowedMimeTypes &&
    !params.allowedMimeTypes
      .map((item) => item.toLowerCase())
      .includes(detectedMimeType)
  ) {
    throwUnsupportedFileFormat();
  }
}

async function assertValidImageBuffer(params: {
  buffer: Buffer;
  maxPixelCount?: number;
}) {
  try {
    const sharpOptions =
      params.maxPixelCount === undefined
        ? undefined
        : { limitInputPixels: params.maxPixelCount };

    await sharp(params.buffer, sharpOptions).rotate().toBuffer();
  } catch {
    throw createStorageFileBadRequest(
      'INVALID_IMAGE',
      'Изображение повреждено или имеет неверный формат.',
    );
  }
}

function throwUnsupportedFileFormat(): never {
  throw createStorageFileBadRequest(
    'UNSUPPORTED_FILE_FORMAT',
    'Формат файла не поддерживается.',
  );
}

function extensionMatchesMimeType(extension: string, mimeType: string) {
  if (mimeType === 'image/jpeg') {
    return extension === 'jpg' || extension === 'jpeg';
  }

  return getExtensionByMimeType(mimeType) === extension;
}

function detectImageMimeType(buffer: Buffer) {
  if (
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  ) {
    return 'image/jpeg';
  }

  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return 'image/png';
  }

  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return 'image/webp';
  }

  return null;
}
