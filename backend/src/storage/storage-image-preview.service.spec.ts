import { BadRequestException } from '@nestjs/common';
import { StorageDocumentType, StorageOwnerModule, type StorageFile } from '@prisma/client';
import { Readable } from 'node:stream';
import { ImageProcessingService } from '../image-processing/image-processing.service';
import { StorageImagePreviewService } from './storage-image-preview.service';
import { StorageObjectService } from './storage-object.service';

describe('StorageImagePreviewService', () => {
  let imageProcessing: jest.Mocked<Pick<ImageProcessingService, 'createWebpVersions'>>;
  let objectStorage: jest.Mocked<
    Pick<StorageObjectService, 'getObject' | 'getObjectOrNull' | 'putObject'>
  >;
  let service: StorageImagePreviewService;

  beforeEach(() => {
    imageProcessing = {
      createWebpVersions: jest.fn().mockResolvedValue([
        {
          buffer: Buffer.from('webp'),
          contentType: 'image/webp',
          size: 'medium',
        },
      ]),
    };
    objectStorage = {
      getObject: jest.fn().mockResolvedValue({
        body: Readable.from(Buffer.from('source')),
        contentLength: 6,
        contentType: 'image/jpeg',
      }),
      getObjectOrNull: jest.fn().mockResolvedValue(null),
      putObject: jest.fn().mockResolvedValue({
        bucket: 'bucket',
        key: 'storage-previews/1/medium.webp',
      }),
    };
    service = new StorageImagePreviewService(
      imageProcessing as never,
      objectStorage as never,
    );
  });

  it('returns cached preview without loading source object', async () => {
    const cachedPreview = {
      body: Readable.from(Buffer.from('cached')),
      contentLength: 6,
      contentType: 'image/webp',
    };
    objectStorage.getObjectOrNull.mockResolvedValueOnce(cachedPreview);

    await expect(service.getPreview(createImageFile(), 'medium')).resolves.toBe(
      cachedPreview,
    );

    expect(objectStorage.getObject).not.toHaveBeenCalled();
    expect(imageProcessing.createWebpVersions).not.toHaveBeenCalled();
  });

  it('rejects by file metadata size before loading source object', async () => {
    await expect(
      service.getPreview(
        createImageFile({ sizeBytes: BigInt(51 * 1024 * 1024) }),
        'medium',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(objectStorage.getObject).not.toHaveBeenCalled();
  });

  it('rejects by source contentLength before buffering stream', async () => {
    objectStorage.getObject.mockResolvedValueOnce({
      body: Readable.from(Buffer.from('source')),
      contentLength: 51 * 1024 * 1024,
      contentType: 'image/jpeg',
    });

    await expect(
      service.getPreview(createImageFile(), 'medium'),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'FILE_TOO_LARGE' }),
    });

    expect(imageProcessing.createWebpVersions).not.toHaveBeenCalled();
  });

  it('rejects when stream exceeds preview size limit while buffering', async () => {
    objectStorage.getObject.mockResolvedValueOnce({
      body: Readable.from([
        Buffer.alloc(25 * 1024 * 1024),
        Buffer.alloc(26 * 1024 * 1024),
      ]),
      contentLength: undefined,
      contentType: 'image/jpeg',
    });

    await expect(
      service.getPreview(createImageFile(), 'medium'),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'FILE_TOO_LARGE' }),
    });

    expect(imageProcessing.createWebpVersions).not.toHaveBeenCalled();
  });

  it('creates and stores preview for a normal small source stream', async () => {
    const result = await service.getPreview(createImageFile(), 'medium');

    expect(imageProcessing.createWebpVersions).toHaveBeenCalledWith(
      expect.objectContaining({
        file: expect.objectContaining({
          buffer: Buffer.from('source'),
          mimetype: 'image/jpeg',
        }),
      }),
    );
    expect(objectStorage.putObject).toHaveBeenCalledWith({
      body: Buffer.from('webp'),
      contentType: 'image/webp',
      key: 'storage-previews/1/medium.webp',
    });
    expect(result.contentLength).toBe(4);
    expect(result.contentType).toBe('image/webp');
  });
});

function createImageFile(overrides: Partial<StorageFile> = {}): StorageFile {
  return {
    bucket: 'bucket',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    deletedAt: null,
    documentType: StorageDocumentType.equipment_photo,
    id: 1,
    isPrimary: true,
    mimeType: 'image/jpeg',
    objectKey: 'equipment/equipment/10/equipment_photo/photo.jpg',
    originalName: 'photo.jpg',
    ownerEntityId: 10,
    ownerEntityType: 'equipment',
    ownerModule: StorageOwnerModule.EQUIPMENT,
    sizeBytes: 100n,
    uploadedByUserId: null,
    ...overrides,
  };
}
