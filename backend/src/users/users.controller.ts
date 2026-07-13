import {
  BadRequestException,
  Controller,
  Get,
  Header,
  Param,
  Res,
  StreamableFile,
} from '@nestjs/common';
import type { Response } from 'express';
import { isUserPhotoSize } from './user-photo-size';
import { UserPhotoService } from './user-photo.service';
import { UsersService } from './users.service';

@Controller('api/users')
export class UsersController {
  constructor(
    private readonly userPhotoService: UserPhotoService,
    private readonly usersService: UsersService,
  ) {}

  @Get(':id/profile')
  findProfile(@Param('id') id: string) {
    return this.usersService.findProfile(id);
  }

  @Get(':id/photo/:size')
  @Header('Cache-Control', 'private, max-age=31536000, immutable')
  async getPhoto(
    @Param('id') id: string,
    @Param('size') size: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    if (!isUserPhotoSize(size)) {
      throw new BadRequestException({
        code: 'UNSUPPORTED_PHOTO_SIZE',
        message: 'Неподдерживаемый размер фото.',
      });
    }

    const photo = await this.userPhotoService.getPhotoObject(id, size);

    response.setHeader('Content-Type', 'image/webp');

    if (photo.contentLength !== undefined) {
      response.setHeader('Content-Length', String(photo.contentLength));
    }

    return new StreamableFile(photo.body);
  }
}
