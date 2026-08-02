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
  ParseIntPipe,
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
import { assertCanManageFiles } from '../auth/role-permissions';
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
    assertCanManageFiles(session.user.role);

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
  @Header('Cache-Control', 'private, max-age=0, no-cache')
  async download(
    @Param('visibleId', ParseIntPipe) visibleId: number,
    @Param('fileId', ParseIntPipe) fileId: number,
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
  async preview(
    @Param('visibleId', ParseIntPipe) visibleId: number,
    @Param('fileId', ParseIntPipe) fileId: number,
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
  async delete(
    @Param('visibleId', ParseIntPipe) visibleId: number,
    @Param('fileId', ParseIntPipe) fileId: number,
    @Session() session: UserSession<Auth>,
  ) {
    assertCanManageFiles(session.user.role);

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
  async setPrimary(
    @Param('visibleId', ParseIntPipe) visibleId: number,
    @Param('fileId', ParseIntPipe) fileId: number,
    @Session() session: UserSession<Auth>,
  ) {
    assertCanManageFiles(session.user.role);

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
