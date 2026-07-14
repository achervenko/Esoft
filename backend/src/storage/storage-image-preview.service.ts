import { Injectable } from '@nestjs/common';
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

    const source = await this.objectStorage.getObject(file.objectKey);
    const sourceBuffer = await streamToBuffer(source.body);
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

async function streamToBuffer(stream: Readable) {
  const chunks: Buffer[] = [];

  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  return Buffer.concat(chunks);
}
