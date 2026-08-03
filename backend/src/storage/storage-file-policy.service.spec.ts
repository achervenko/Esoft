import { BadRequestException } from '@nestjs/common';
import {
  StorageDocumentType,
  StorageOwnerModule,
  type StorageFile,
} from '@prisma/client';
import { StorageFilePolicyService } from './storage-file-policy.service';
import type { StorageFilePolicyConfig } from './storage-file-policy.config';
import type { UploadedFileInput } from './storage.types';

jest.mock('sharp', () =>
  jest.fn(() => ({
    rotate: jest.fn().mockReturnThis(),
    toBuffer: jest.fn().mockResolvedValue(Buffer.from('ok')),
  })),
);

describe('StorageFilePolicyService', () => {
  let service: StorageFilePolicyService;

  beforeEach(() => {
    service = new StorageFilePolicyService(createPolicyConfig());
  });

  it('accepts allowed PDF extension, MIME and content signature', async () => {
    await expect(
      service.assertFileMatchesDocumentType({
        documentType: StorageDocumentType.passport,
        file: createFile({
          buffer: Buffer.from('%PDF-1.4\nbody\n%%EOF', 'ascii'),
          mimetype: 'application/pdf',
          originalname: 'passport.pdf',
        }),
      }),
    ).resolves.toBeUndefined();
  });

  it('rejects forbidden extension and forbidden MIME', async () => {
    await expect(
      service.assertFileMatchesDocumentType({
        documentType: StorageDocumentType.passport,
        file: createFile({
          mimetype: 'application/pdf',
          originalname: 'passport.exe',
        }),
      }),
    ).rejects.toMatchObject({
      response: { code: 'UNSUPPORTED_FILE_FORMAT' },
    });

    await expect(
      service.assertFileMatchesDocumentType({
        documentType: StorageDocumentType.passport,
        file: createFile({
          mimetype: 'text/plain',
          originalname: 'passport.pdf',
        }),
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('requires extension, declared MIME and image magic bytes to match', async () => {
    await expect(
      service.assertFileMatchesDocumentType({
        documentType: StorageDocumentType.equipment_photo,
        file: createFile({
          buffer: pngBytes(),
          mimetype: 'image/jpeg',
          originalname: 'photo.jpg',
        }),
      }),
    ).rejects.toMatchObject({
      response: { code: 'UNSUPPORTED_FILE_FORMAT' },
    });
  });

  it.each([
    ['JPEG', jpegBytes(), 'image/jpeg', 'photo.jpg'],
    ['PNG', pngBytes(), 'image/png', 'photo.png'],
    ['WebP', webpBytes(), 'image/webp', 'photo.webp'],
  ])(
    'accepts valid %s image signatures',
    async (_label, buffer, mimetype, name) => {
      await expect(
        service.assertFileMatchesDocumentType({
          documentType: StorageDocumentType.equipment_photo,
          file: createFile({ buffer, mimetype, originalname: name }),
        }),
      ).resolves.toBeUndefined();
    },
  );

  it('rejects a second active file for single document types', () => {
    expect(() =>
      service.assertDocumentCanBeAdded({
        activeFiles: [
          createStorageFile({ documentType: StorageDocumentType.passport }),
        ],
        documentType: StorageDocumentType.passport,
      }),
    ).toThrow(BadRequestException);
  });

  it('makes primary by documentType, not by any existing owner file', () => {
    expect(
      service.shouldMakePrimary({
        activeFiles: [
          createStorageFile({
            documentType: StorageDocumentType.passport,
            isPrimary: true,
          }),
        ],
        documentType: StorageDocumentType.equipment_photo,
      }),
    ).toBe(true);

    expect(
      service.shouldMakePrimary({
        activeFiles: [
          createStorageFile({
            documentType: StorageDocumentType.equipment_photo,
            isPrimary: true,
          }),
        ],
        documentType: StorageDocumentType.equipment_photo,
      }),
    ).toBe(false);
  });
});

function createPolicyConfig(): StorageFilePolicyConfig {
  return {
    documentRules: {
      [StorageDocumentType.passport]: {
        allowedExtensions: ['pdf'],
        allowedMimeTypes: ['application/pdf'],
        validateContent: 'pdf',
      },
      [StorageDocumentType.equipment_photo]: {
        allowedExtensions: ['jpg', 'jpeg', 'png', 'webp'],
        allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
        validateContent: 'image',
      },
    },
    primaryDocumentTypes: [StorageDocumentType.equipment_photo],
    singleDocumentTypes: [StorageDocumentType.passport],
  };
}

function createFile(
  overrides: Partial<UploadedFileInput> = {},
): UploadedFileInput {
  const buffer = Buffer.from('%PDF-1.4\n%%EOF', 'ascii');

  return {
    buffer,
    mimetype: 'application/pdf',
    originalname: 'file.pdf',
    size: buffer.length,
    ...overrides,
  };
}

function createStorageFile(overrides: Partial<StorageFile> = {}): StorageFile {
  return {
    bucket: 'bucket',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    deletedAt: null,
    documentType: StorageDocumentType.passport,
    id: 1,
    isPrimary: false,
    mimeType: 'application/pdf',
    objectKey: 'key',
    originalName: 'file.pdf',
    ownerEntityId: 10,
    ownerEntityType: 'equipment',
    ownerModule: StorageOwnerModule.EQUIPMENT,
    sizeBytes: 100n,
    uploadedByUserId: null,
    ...overrides,
  };
}

function jpegBytes() {
  return Buffer.from([0xff, 0xd8, 0xff, 0x00]);
}

function pngBytes() {
  return Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
}

function webpBytes() {
  return Buffer.from('RIFFxxxxWEBP', 'ascii');
}
