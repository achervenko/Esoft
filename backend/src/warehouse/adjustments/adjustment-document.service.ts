import { Injectable } from '@nestjs/common';
import { StorageDocumentType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageStagedUploadService } from '../../storage/storage-staged-upload.service';
import type { UploadedFileInput } from '../../storage/storage.types';
import { WarehouseStockAdjustmentAccessService } from './adjustment-access.service';
import { ADJUSTMENT_OWNER } from './adjustments.constants';

@Injectable()
export class WarehouseStockAdjustmentDocumentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly uploads: StorageStagedUploadService,
    private readonly access: WarehouseStockAdjustmentAccessService,
  ) {}

  async uploadDocument(
    file: UploadedFileInput | undefined,
    actorUserId: string,
  ) {
    await this.prisma.$transaction((tx) =>
      this.access.assertAdmin(tx, actorUserId),
    );
    return this.uploads.prepare(
      ADJUSTMENT_OWNER,
      actorUserId,
      StorageDocumentType.supporting_document,
      file,
      {
        allowedExtensions: ['pdf', 'jpg', 'jpeg', 'png', 'webp'],
        allowedMimeTypes: [
          'application/pdf',
          'image/jpeg',
          'image/png',
          'image/webp',
        ],
        maxPixelCount: 120_000_000,
        validateContent: 'document',
      },
    );
  }
}
