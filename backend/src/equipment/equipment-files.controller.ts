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
          message:
            '\u041e\u0431\u043e\u0440\u0443\u0434\u043e\u0432\u0430\u043d\u0438\u0435 \u043d\u0435 \u043d\u0430\u0439\u0434\u0435\u043d\u043e.',
        });
      }

      throw error;
    }
  }
}
