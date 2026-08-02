import { BadRequestException, Injectable } from '@nestjs/common';
import type { StorageFile } from '@prisma/client';
import { Readable } from 'node:stream';
import { ImageProcessingService } from '../image-processing/image-processing.service';
import type { StorageImagePreviewSize, StoredObject } from './storage.types';
import { StorageObjectService } from './storage-object.service';

const PREVIEW_CONSTRAINTS = {
  maxFileSizeBytes: 50 * 1024 * 1024,
  maxPixelCount: 120_000_000,
  minShortSidePx: 1,
};

const PREVIEW_VERSIONS = [
  {
    height: 48,
    quality: 76,
    size: 'small',
    width: 48,
  },
  {
    height: 256,
    quality: 82,
    size: 'medium',
    width: 256,
  },
] as const;

@Injectable()
export class StorageImagePreviewService {
  constructor(
    private readonly imageProcessing: ImageProcessingService,
    private readonly objectStorage: StorageObjectService,
  ) {}

  async getPreview(
    file: StorageFile,
    size: StorageImagePreviewSize,
  ): Promise<StoredObject> {
    const previewKey = createPreviewObjectKey(file, size);
    const cachedPreview = await this.objectStorage.getObjectOrNull(previewKey);

    if (cachedPreview) {
      return cachedPreview;
    }

    assertPreviewSourceSize(
      Number(file.sizeBytes),
      PREVIEW_CONSTRAINTS.maxFileSizeBytes,
    );

    const source = await this.objectStorage.getObject(file.objectKey);
    assertPreviewSourceSize(
      source.contentLength,
      PREVIEW_CONSTRAINTS.maxFileSizeBytes,
    );

    const sourceBuffer = await streamToBuffer(
      source.body,
      PREVIEW_CONSTRAINTS.maxFileSizeBytes,
    );
    const [preview] = await this.imageProcessing.createWebpVersions({
      constraints: PREVIEW_CONSTRAINTS,
      file: {
        buffer: sourceBuffer,
        mimetype: file.mimeType,
        originalname: file.originalName,
        size: Number(file.sizeBytes),
      },
      versions: PREVIEW_VERSIONS.filter((version) => version.size === size),
    });

    await this.objectStorage.putObject({
      body: preview.buffer,
      contentType: preview.contentType,
      key: previewKey,
    });

    return {
      body: Readable.from(preview.buffer),
      contentLength: preview.buffer.length,
      contentType: preview.contentType,
    };
  }
}

function createPreviewObjectKey(
  file: StorageFile,
  size: StorageImagePreviewSize,
) {
  return `storage-previews/${file.id}/${size}.webp`;
}

async function streamToBuffer(
  stream: Readable,
  maxSizeBytes: number,
): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let sizeBytes = 0;

  for await (const chunk of stream) {
    if (Buffer.isBuffer(chunk)) {
      chunks.push(chunk);
      sizeBytes += chunk.length;
      assertPreviewSourceSize(sizeBytes, maxSizeBytes);
      continue;
    }

    if (typeof chunk === 'string') {
      const buffer = Buffer.from(chunk);
      chunks.push(buffer);
      sizeBytes += buffer.length;
      assertPreviewSourceSize(sizeBytes, maxSizeBytes);
      continue;
    }

    if (chunk instanceof Uint8Array) {
      const buffer = Buffer.from(chunk);
      chunks.push(buffer);
      sizeBytes += buffer.length;
      assertPreviewSourceSize(sizeBytes, maxSizeBytes);
      continue;
    }

    throw new TypeError('Поток содержит неподдерживаемый тип данных.');
  }

  return Buffer.concat(chunks);
}

function assertPreviewSourceSize(sizeBytes: number | undefined, limit: number) {
  if (sizeBytes !== undefined && sizeBytes > limit) {
    throw new BadRequestException({
      code: 'FILE_TOO_LARGE',
      message: 'Файл слишком большой для генерации превью.',
    });
  }
}
