import { BadRequestException } from '@nestjs/common';
import { StorageDocumentType } from '@prisma/client';
import {
  assertValidStorageDocumentType,
  assertValidStorageFile,
  MAX_FILE_SIZE_BYTES,
} from './storage-file.validation';
import type { UploadedFileInput } from './storage.types';

describe('storage-file validation', () => {
  it('validates the actual buffer length instead of trusting uploaded size', () => {
    expect(() =>
      assertValidStorageFile(
        createFile({
          buffer: Buffer.from('content'),
          size: MAX_FILE_SIZE_BYTES + 1,
        }),
      ),
    ).not.toThrow();
  });

  it.each([
    ['missing file', undefined, 'FILE_REQUIRED'],
    [
      'empty buffer',
      createFile({ buffer: Buffer.alloc(0), size: 999 }),
      'EMPTY_FILE',
    ],
    [
      'too large buffer',
      createFile({ buffer: Buffer.alloc(MAX_FILE_SIZE_BYTES + 1) }),
      'FILE_TOO_LARGE',
    ],
    [
      'empty original name',
      createFile({ originalname: '   ' }),
      'UNSUPPORTED_FILE_FORMAT',
    ],
  ])('rejects %s with a stable bad request code', (_label, file, code) => {
    expect(() => assertValidStorageFile(file)).toThrow(BadRequestException);
    expect(() => assertValidStorageFile(file)).toThrow(
      expect.objectContaining({
        response: expect.objectContaining({ code }),
      }),
    );
  });

  it('accepts known document types and rejects unknown runtime values', () => {
    expect(() =>
      assertValidStorageDocumentType(StorageDocumentType.passport),
    ).not.toThrow();

    expect(() => assertValidStorageDocumentType('INVALID_VALUE')).toThrow(
      expect.objectContaining({
        response: expect.objectContaining({
          code: 'UNSUPPORTED_DOCUMENT_TYPE',
        }),
      }),
    );
  });
});

function createFile(overrides: Partial<UploadedFileInput> = {}): UploadedFileInput {
  const buffer = Buffer.from('content');

  return {
    buffer,
    mimetype: 'application/octet-stream',
    originalname: 'file.bin',
    size: buffer.length,
    ...overrides,
  };
}
