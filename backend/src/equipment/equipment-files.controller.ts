import { ParsePositiveIntPipe } from '../application/pipes/parse-positive-int.pipe';
import { FILES_PERMISSIONS } from '../storage/files.permissions';
import { RequirePermission } from '../auth/require-permission';
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Header,
  NotFoundException,
  Param,
  ParseEnumPipe,
  Patch,
  Post,
  Query,
  Res,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuditModule, StorageDocumentType } from '@prisma/client';
import { Session, type UserSession } from '@thallesp/nestjs-better-auth';
import type { Response } from 'express';
import type { Auth } from '../auth/auth.config';
import { StorageFileService } from '../storage/storage-file.service';
import { MAX_FILE_SIZE_BYTES } from '../storage/storage-file.validation';
import type {
  StorageImagePreviewSize,
  UploadedFileInput,
} from '../storage/storage.types';
import { EquipmentService } from './equipment.service';

@Controller('api/equipment/:visibleId/files')
export class EquipmentFilesController {
  constructor(
    private readonly equipmentService: EquipmentService,
    private readonly storageFileService: StorageFileService,
  ) {}

  @Get()
  @RequirePermission(FILES_PERMISSIONS.READ)
  async list(@Param('visibleId', ParsePositiveIntPipe) visibleId: number) {
    const owner = await this.findStorageOwnerByVisibleId(visibleId);

    return this.storageFileService.listFiles(owner);
  }

  @Post()
  @RequirePermission(FILES_PERMISSIONS.MANAGE)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: MAX_FILE_SIZE_BYTES,
      },
    }),
  )
  async upload(
    @Param('visibleId', ParsePositiveIntPipe) visibleId: number,
    @Body(
      'documentType',
      new ParseEnumPipe(StorageDocumentType, {
        exceptionFactory: () =>
          new BadRequestException({
            code: 'INVALID_DOCUMENT_TYPE',
            message: 'Указан недопустимый тип документа.',
          }),
      }),
    )
    documentType: StorageDocumentType,
    @UploadedFile() file: UploadedFileInput | undefined,
    @Session() session: UserSession<Auth>,
  ) {
    const owner = await this.findStorageOwnerByVisibleId(visibleId);

    return this.storageFileService.uploadFile({
      audit: {
        actionModule: AuditModule.EQUIPMENT,
      },
      documentType,
      file,
      owner,
      userId: session.user.id,
    });
  }

  @Get(':fileId/download')
  @RequirePermission(FILES_PERMISSIONS.READ)
  @Header('Cache-Control', 'private, max-age=0, no-cache')
  async download(
    @Param('visibleId', ParsePositiveIntPipe) visibleId: number,
    @Param('fileId', ParsePositiveIntPipe) fileId: number,
    @Res({ passthrough: true }) response: Response,
  ) {
    const owner = await this.findStorageOwnerByVisibleId(visibleId);
    const file = await this.storageFileService.getDownload({ fileId, owner });

    response.setHeader('Content-Type', file.contentType);
    response.setHeader(
      'Content-Disposition',
      createContentDisposition('attachment', file.fileName),
    );

    if (file.contentLength !== undefined) {
      response.setHeader('Content-Length', String(file.contentLength));
    }

    return new StreamableFile(file.body);
  }

  @Get(':fileId/preview')
  @RequirePermission(FILES_PERMISSIONS.READ)
  async preview(
    @Param('visibleId', ParsePositiveIntPipe) visibleId: number,
    @Param('fileId', ParsePositiveIntPipe) fileId: number,
    @Query('size') size: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ) {
    const owner = await this.findStorageOwnerByVisibleId(visibleId);
    const file = await this.storageFileService.getPreview({
      fileId,
      owner,
      size: toStorageImagePreviewSize(size),
    });

    response.setHeader('Content-Type', file.contentType);
    response.setHeader(
      'Cache-Control',
      file.isOptimizedImagePreview
        ? 'private, max-age=31536000, immutable'
        : 'private, max-age=86400',
    );
    response.setHeader(
      'Content-Disposition',
      createContentDisposition('inline', file.fileName),
    );

    if (file.contentLength !== undefined) {
      response.setHeader('Content-Length', String(file.contentLength));
    }

    return new StreamableFile(file.body);
  }

  @Delete(':fileId')
  @RequirePermission(FILES_PERMISSIONS.MANAGE)
  async delete(
    @Param('visibleId', ParsePositiveIntPipe) visibleId: number,
    @Param('fileId', ParsePositiveIntPipe) fileId: number,
    @Session() session: UserSession<Auth>,
  ) {
    const owner = await this.findStorageOwnerByVisibleId(visibleId);

    return this.storageFileService.softDeleteFile({
      audit: {
        actionModule: AuditModule.EQUIPMENT,
      },
      fileId,
      owner,
      userId: session.user.id,
    });
  }

  @Patch(':fileId/primary')
  @RequirePermission(FILES_PERMISSIONS.MANAGE)
  async setPrimary(
    @Param('visibleId', ParsePositiveIntPipe) visibleId: number,
    @Param('fileId', ParsePositiveIntPipe) fileId: number,
    @Session() session: UserSession<Auth>,
  ) {
    const owner = await this.findStorageOwnerByVisibleId(visibleId);

    return this.storageFileService.setPrimaryFile({
      audit: {
        actionModule: AuditModule.EQUIPMENT,
      },
      fileId,
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

function createContentDisposition(
  disposition: 'attachment' | 'inline',
  fileName: string,
) {
  const fallbackFileName = fileName
    .replace(/[^\x20-\x7E]/g, '_')
    .replace(/["\\]/g, '_');
  const encodedFileName = encodeURIComponent(fileName).replace(
    /[!'()*]/g,
    (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  );

  return `${disposition}; filename="${fallbackFileName}"; filename*=UTF-8''${encodedFileName}`;
}

function toStorageImagePreviewSize(
  value: string | undefined,
): StorageImagePreviewSize | undefined {
  if (!value) {
    return undefined;
  }

  if (value === 'small' || value === 'medium') {
    return value;
  }

  throw new BadRequestException({
    code: 'INVALID_PREVIEW_SIZE',
    message: 'Указан недопустимый размер превью.',
  });
}
