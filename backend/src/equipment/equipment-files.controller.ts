import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuditModule } from '@prisma/client';
import { Session, type UserSession } from '@thallesp/nestjs-better-auth';
import type { Auth } from '../auth/auth.config';
import { assertCanManageFiles } from '../auth/role-permissions';
import { StorageFileService } from '../storage/storage-file.service';
import type { UploadedFileInput } from '../storage/storage.types';
import { EquipmentService } from './equipment.service';

const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024;

@Controller('api/equipment/:visibleId/files')
export class EquipmentFilesController {
  constructor(
    private readonly equipmentService: EquipmentService,
    private readonly storageFileService: StorageFileService,
  ) {}

  @Get()
  async list(@Param('visibleId', ParseIntPipe) visibleId: number) {
    const owner = await this.equipmentService.findStorageOwnerByVisibleId(
      visibleId,
    );

    return this.storageFileService.listFiles(owner);
  }

  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: MAX_FILE_SIZE_BYTES,
      },
    }),
  )
  async upload(
    @Param('visibleId', ParseIntPipe) visibleId: number,
    @UploadedFile() file: UploadedFileInput,
    @Session() session: UserSession<Auth>,
  ) {
    assertCanManageFiles(session.user.role);

    const owner = await this.equipmentService.findStorageOwnerByVisibleId(
      visibleId,
    );

    return this.storageFileService.uploadFile({
      audit: {
        actionModule: AuditModule.EQUIPMENT,
        entityId: owner.entityId,
        entityType: owner.entityType,
      },
      file,
      owner,
      userId: session.user.id,
    });
  }
}
