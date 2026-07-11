import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { PrismaService } from '../prisma/prisma.service';
import { loadStorageConfig } from './config/storage-config.loader';
import { FilesController } from './files.controller';
import { s3ClientProvider } from './s3/s3-client.provider';
import { StorageController } from './storage.controller';
import { StorageFileService } from './storage-file.service';
import { StorageObjectService } from './storage-object.service';
import { StorageOwnerService } from './storage-owner.service';
import { STORAGE_CONFIG } from './storage.tokens';

@Module({
  imports: [AuditModule],
  controllers: [FilesController, StorageController],
  exports: [StorageFileService, StorageObjectService, StorageOwnerService],
  providers: [
    {
      provide: STORAGE_CONFIG,
      useFactory: loadStorageConfig,
    },
    s3ClientProvider,
    PrismaService,
    StorageFileService,
    StorageObjectService,
    StorageOwnerService,
  ],
})
export class StorageModule {}
