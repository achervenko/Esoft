import { DynamicModule, Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { ImageProcessingModule } from '../image-processing/image-processing.module';
import { PrismaModule } from '../prisma/prisma.module';
import { loadStorageConfig } from './config/storage-config.loader';
import { s3ClientProvider } from './s3/s3-client.provider';
import {
  STORAGE_FILE_POLICY_CONFIG,
  type StorageFilePolicyConfig,
} from './storage-file-policy.config';
import { StorageFilePrimaryService } from './storage-file-primary.service';
import { StorageFileService } from './storage-file.service';
import { StorageFilePolicyService } from './storage-file-policy.service';
import { StorageFileUploadService } from './storage-file-upload.service';
import { StorageFileUploadTransactionService } from './storage-file-upload-transaction.service';
import { StorageImagePreviewService } from './storage-image-preview.service';
import { StorageObjectService } from './storage-object.service';
import { StorageOwnerLockService } from './storage-owner-lock.service';
import { StorageOwnerService } from './storage-owner.service';
import { STORAGE_CONFIG } from './storage.tokens';

const storageProviders = [
  {
    provide: STORAGE_CONFIG,
    useFactory: loadStorageConfig,
  },
  s3ClientProvider,
  StorageFilePrimaryService,
  StorageFileService,
  StorageFilePolicyService,
  StorageFileUploadService,
  StorageFileUploadTransactionService,
  StorageImagePreviewService,
  StorageObjectService,
  StorageOwnerLockService,
  StorageOwnerService,
];

const storageExports = [
  StorageFileService,
  StorageObjectService,
  StorageOwnerService,
];

@Module({})
export class StorageModule {
  static register(policyConfig: StorageFilePolicyConfig): DynamicModule {
    return {
      module: StorageModule,
      global: true,
      imports: [AuditModule, ImageProcessingModule, PrismaModule],
      exports: storageExports,
      providers: [
        {
          provide: STORAGE_FILE_POLICY_CONFIG,
          useValue: policyConfig,
        },
        ...storageProviders,
      ],
    };
  }
}
