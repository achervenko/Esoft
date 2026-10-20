import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  Post,
  Query,
  Res,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { Session, type UserSession } from '@thallesp/nestjs-better-auth';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import type { Auth } from '../../auth/auth.config';
import { RequirePermission } from '../../auth/require-permission';
import { ParsePositiveIntPipe } from '../../application/pipes/parse-positive-int.pipe';
import { StorageFileService } from '../../storage/storage-file.service';
import { MAX_FILE_SIZE_BYTES } from '../../storage/storage-file.validation';
import { createContentDisposition } from '../../storage/storage-http.helper';
import type { UploadedFileInput } from '../../storage/storage.types';
import { WAREHOUSE_PERMISSIONS } from '../warehouse.permissions';
import { ADJUSTMENT_OWNER } from './adjustments.constants';
import { WarehouseStockAdjustmentsService } from './adjustments.service';

@Controller('api/warehouse/adjustments')
export class WarehouseStockAdjustmentsController {
  constructor(
    private readonly adjustments: WarehouseStockAdjustmentsService,
    private readonly files: StorageFileService,
  ) {}

  @Get()
  @RequirePermission(WAREHOUSE_PERMISSIONS.ADJUSTMENTS_MANAGE)
  list(@Query() query: unknown, @Session() session: UserSession<Auth>) {
    return this.adjustments.list(query, session.user.id);
  }

  @Post('documents')
  @RequirePermission(WAREHOUSE_PERMISSIONS.ADJUSTMENTS_MANAGE)
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: MAX_FILE_SIZE_BYTES } }),
  )
  uploadDocument(
    @UploadedFile() file: UploadedFileInput | undefined,
    @Session() session: UserSession<Auth>,
  ) {
    return this.adjustments.uploadDocument(file, session.user.id);
  }

  @Post()
  @RequirePermission(WAREHOUSE_PERMISSIONS.ADJUSTMENTS_MANAGE)
  create(@Body() payload: unknown, @Session() session: UserSession<Auth>) {
    return this.adjustments.adjustStock(payload, session.user.id);
  }

  @Get(':id')
  @RequirePermission(WAREHOUSE_PERMISSIONS.ADJUSTMENTS_MANAGE)
  get(@Param('id') id: string, @Session() session: UserSession<Auth>) {
    return this.adjustments.get(id, session.user.id);
  }

  @Get(':id/documents/:fileId/download')
  @RequirePermission(WAREHOUSE_PERMISSIONS.ADJUSTMENTS_MANAGE)
  @Header('Cache-Control', 'private, max-age=0, no-cache')
  async download(
    @Param('id') id: string,
    @Param('fileId', ParsePositiveIntPipe) fileId: number,
    @Session() session: UserSession<Auth>,
    @Res({ passthrough: true }) response: Response,
  ) {
    const adjustment = await this.adjustments.get(id, session.user.id);
    const file = await this.files.getDownload({
      fileId,
      owner: { ...ADJUSTMENT_OWNER, entityId: adjustment.id },
    });
    response.setHeader('Content-Type', file.contentType);
    response.setHeader(
      'Content-Disposition',
      createContentDisposition('attachment', file.fileName),
    );
    if (file.contentLength !== undefined)
      response.setHeader('Content-Length', String(file.contentLength));
    return new StreamableFile(file.body);
  }
}
