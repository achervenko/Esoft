import {
  Controller,
  Delete,
  Get,
  Header,
  Param,
  ParseIntPipe,
  Res,
  StreamableFile,
} from '@nestjs/common';
import { Session, type UserSession } from '@thallesp/nestjs-better-auth';
import type { Response } from 'express';
import { assertCanManageFiles } from '../auth/role-permissions';
import type { Auth } from '../auth/auth.config';
import { StorageFileService } from './storage-file.service';

@Controller('api/files')
export class FilesController {
  constructor(private readonly storageFileService: StorageFileService) {}

  @Get(':fileId/download')
  @Header('Cache-Control', 'private, max-age=0, no-cache')
  async download(
    @Param('fileId', ParseIntPipe) fileId: number,
    @Res({ passthrough: true }) response: Response,
  ) {
    const file = await this.storageFileService.getDownload(fileId);

    response.setHeader('Content-Type', file.contentType);
    response.setHeader(
      'Content-Disposition',
      createContentDisposition(file.fileName),
    );

    if (file.contentLength !== undefined) {
      response.setHeader('Content-Length', String(file.contentLength));
    }

    return new StreamableFile(file.body);
  }

  @Delete(':fileId')
  delete(
    @Param('fileId', ParseIntPipe) fileId: number,
    @Session() session: UserSession<Auth>,
  ) {
    assertCanManageFiles(session.user.role);

    return this.storageFileService.softDeleteFileById({
      fileId,
      userId: session.user.id,
    });
  }
}

function createContentDisposition(fileName: string) {
  const fallbackFileName = fileName.replace(/[^\x20-\x7E]/g, '_');
  return `attachment; filename="${fallbackFileName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}
