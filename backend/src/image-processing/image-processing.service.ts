import { BadRequestException, Injectable } from '@nestjs/common';
import sharp from 'sharp';
import type { UploadedFileInput } from '../storage/storage.types';
import type {
  ImageProcessingConstraints,
  ImageProcessingVersion,
  ProcessedImageVersion,
} from './image-processing.types';

const DEFAULT_SUPPORTED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
]);
const DEFAULT_SUPPORTED_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp']);

@Injectable()
export class ImageProcessingService {
  async createWebpVersions<Size extends string>(params: {
    constraints: ImageProcessingConstraints;
    file: UploadedFileInput | undefined;
    versions: readonly ImageProcessingVersion<Size>[];
  }): Promise<Array<ProcessedImageVersion<Size>>> {
    this.assertFileIsPresent(params.file);
    this.assertFileMeta(params.file, params.constraints);

    const normalizedBuffer = await this.decodeAndNormalize(
      params.file.buffer,
      params.constraints.maxPixelCount,
    );
    const metadata = await this.readMetadata(
      normalizedBuffer,
      params.constraints.maxPixelCount,
    );
    const width = metadata.width ?? 0;
    const height = metadata.height ?? 0;

    if (!width || !height) {
      throwInvalidImage();
    }

    if (Math.min(width, height) < params.constraints.minShortSidePx) {
      throw new BadRequestException({
        code: 'IMAGE_TOO_SMALL',
        message: `Короткая сторона фото должна быть не меньше ${params.constraints.minShortSidePx} px.`,
      });
    }

    if (width * height > params.constraints.maxPixelCount) {
      throw new BadRequestException({
        code: 'IMAGE_PIXEL_LIMIT_EXCEEDED',
        message: 'Разрешение фото не должно превышать 25 МП.',
      });
    }

    return Promise.all(
      params.versions.map(async (version) => ({
        buffer: await sharp(normalizedBuffer, {
          limitInputPixels: params.constraints.maxPixelCount,
        })
          .resize(version.width, version.height ?? version.width, {
            fit: version.fit ?? 'cover',
            position: version.position ?? 'attention',
            withoutEnlargement: version.withoutEnlargement ?? true,
          })
          .webp({ quality: version.quality })
          .toBuffer(),
        contentType: 'image/webp' as const,
        size: version.size,
      })),
    );
  }

  private assertFileIsPresent(
    file: UploadedFileInput | undefined,
  ): asserts file is UploadedFileInput {
    if (!file) {
      throw new BadRequestException({
        code: 'FILE_REQUIRED',
        message: 'Выберите фото для загрузки.',
      });
    }
  }

  private assertFileMeta(
    file: UploadedFileInput,
    constraints: ImageProcessingConstraints,
  ) {
    if (!file.size || file.size <= 0) {
      throw new BadRequestException({
        code: 'EMPTY_FILE',
        message: 'Файл пустой.',
      });
    }

    if (file.size > constraints.maxFileSizeBytes) {
      throw new BadRequestException({
        code: 'FILE_TOO_LARGE',
        message: 'Размер фото не должен превышать 10 МБ.',
      });
    }

    if (!DEFAULT_SUPPORTED_MIME_TYPES.has(file.mimetype ?? '')) {
      throwUnsupportedFormat();
    }

    const extension = getExtension(file.originalname);
    if (!DEFAULT_SUPPORTED_EXTENSIONS.has(extension)) {
      throwUnsupportedFormat();
    }
  }

  private async decodeAndNormalize(buffer: Buffer, maxPixelCount: number) {
    try {
      return await sharp(buffer, { limitInputPixels: maxPixelCount })
        .rotate()
        .toBuffer();
    } catch {
      throwInvalidImage();
    }
  }

  private async readMetadata(buffer: Buffer, maxPixelCount: number) {
    try {
      return await sharp(buffer, { limitInputPixels: maxPixelCount }).metadata();
    } catch {
      throwInvalidImage();
    }
  }
}

function getExtension(fileName: string) {
  const match = fileName.toLowerCase().match(/\.([a-z0-9]+)$/);
  return match?.[1] ?? '';
}

function throwUnsupportedFormat(): never {
  throw new BadRequestException({
    code: 'UNSUPPORTED_FILE_FORMAT',
    message: 'Для фото доступны только JPG, PNG и WebP.',
  });
}

function throwInvalidImage(): never {
  throw new BadRequestException({
    code: 'INVALID_IMAGE',
    message: 'Не удалось прочитать изображение. Выберите другой файл.',
  });
}
