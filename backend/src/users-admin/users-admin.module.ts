import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { ImageProcessingModule } from '../image-processing/image-processing.module';
import { PrismaModule } from '../prisma/prisma.module';
import { StorageModule } from '../storage/storage.module';
import { EmployeesAdminService } from './employees-admin.service';
import { UserAccountsAdminService } from './user-accounts-admin.service';
import { UserCredentialsAdminService } from './user-credentials-admin.service';
import { UserPhotoProcessingService } from './user-photo-processing.service';
import { UserPhotoStorageService } from './user-photo-storage.service';
import { UserPhotosAdminService } from './user-photos-admin.service';
import { UserStatusAdminService } from './user-status-admin.service';
import { UsersAdminAssertionsService } from './users-admin-assertions.service';
import { UsersAdminAuditService } from './users-admin-audit.service';
import { UsersAdminController } from './users-admin.controller';

@Module({
  imports: [AuditModule, ImageProcessingModule, PrismaModule, StorageModule],
  controllers: [UsersAdminController],
  providers: [
    EmployeesAdminService,
    UserAccountsAdminService,
    UserCredentialsAdminService,
    UsersAdminAssertionsService,
    UsersAdminAuditService,
    UserPhotoProcessingService,
    UserPhotoStorageService,
    UserPhotosAdminService,
    UserStatusAdminService,
  ],
})
export class UsersAdminModule {}
