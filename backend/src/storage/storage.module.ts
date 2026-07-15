import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { ImageProcessingModule } from '../image-processing/image-processing.module';
import { PrismaModule } from '../prisma/prisma.module';
import { loadStorageConfig } from './config/storage-config.loader';
import { FilesController } from './files.controller';
import { s3ClientProvider } from './s3/s3-client.provider';
import { StorageController } from './storage.controller';
import { StorageFilePrimaryService } from './storage-file-primary.service';
import { StorageFileService } from './storage-file.service';
import { StorageFileUploadService } from './storage-file-upload.service';
import { StorageImagePreviewService } from './storage-image-preview.service';
import { StorageObjectService } from './storage-object.service';
import { StorageOwnerService } from './storage-owner.service';
import { STORAGE_CONFIG } from './storage.tokens';

@Module({
  imports: [AuditModule, ImageProcessingModule, PrismaModule],
  controllers: [FilesController, StorageController],
  exports: [StorageFileService, StorageObjectService, StorageOwnerService],
  providers: [
    {
      provide: STORAGE_CONFIG,
      useFactory: loadStorageConfig,
    },
    s3ClientProvider,
    StorageFilePrimaryService,
    StorageFileService,
    StorageFileUploadService,
    StorageImagePreviewService,
    StorageObjectService,
    StorageOwnerService,
  ],
})
export class StorageModule {}
