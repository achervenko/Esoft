import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuditModule, StorageDocumentType } from '@prisma/client';
import { Session, type UserSession } from '@thallesp/nestjs-better-auth';
import type { Auth } from '../auth/auth.config';
import { assertCanManageFiles } from '../auth/role-permissions';
import { StorageFileService } from '../storage/storage-file.service';
import { MAX_FILE_SIZE_BYTES } from '../storage/storage-file.validation';
import type { UploadedFileInput } from '../storage/storage.types';
import { EquipmentService } from './equipment.service';

@Controller('api/equipment/:visibleId/files')
export class EquipmentFilesController {
  constructor(
    private readonly equipmentService: EquipmentService,
    private readonly storageFileService: StorageFileService,
  ) {}

  @Get()
  async list(@Param('visibleId', ParseIntPipe) visibleId: number) {
    const owner = await this.findStorageOwnerByVisibleId(visibleId);

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
    @Body('documentType') documentType: StorageDocumentType,
    @UploadedFile() file: UploadedFileInput,
    @Session() session: UserSession<Auth>,
  ) {
    assertCanManageFiles(session.user.role);

    const owner = await this.findStorageOwnerByVisibleId(visibleId);

    return this.storageFileService.uploadFile({
      audit: {
        actionModule: AuditModule.EQUIPMENT,
        entityId: owner.entityId,
        entityType: owner.entityType,
      },
      documentType,
      file,
      owner,
      userId: session.user.id,
    });
  }

  private async findStorageOwnerByVisibleId(visibleId: number) {
    try {
      return await this.equipmentService.findStorageOwnerByVisibleId(visibleId);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw new NotFoundException({
          code: 'EQUIPMENT_NOT_FOUND',
          message: 'Оборудование не найдено.',
        });
      }

      throw error;
    }
  }
}
