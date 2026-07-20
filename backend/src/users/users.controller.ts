import {
  BadRequestException,
  Controller,
  Get,
  Header,
  Param,
  Res,
  StreamableFile,
} from '@nestjs/common';
import { Session, type UserSession } from '@thallesp/nestjs-better-auth';
import type { Response } from 'express';
import { isUserPhotoSize } from './user-photo-size';
import { UserPhotoService } from './user-photo.service';
import { UsersService } from './users.service';
import type { Auth } from '../auth/auth.config';
import { assertCanViewUserProfile } from '../auth/role-permissions';

@Controller('api/users')
export class UsersController {
  constructor(
    private readonly userPhotoService: UserPhotoService,
    private readonly usersService: UsersService,
  ) {}

  @Get(':id/profile')
  findProfile(@Param('id') id: string, @Session() session: UserSession<Auth>) {
    assertCanViewUserProfile({
      currentUserId: session.user.id,
      requestedUserId: id,
      role: session.user.role,
    });

    return this.usersService.findProfile(id);
  }

  @Get(':id/photo/:size')
  @Header('Cache-Control', 'private, max-age=3600')
  async getPhoto(
    @Param('id') id: string,
    @Param('size') size: string,
    @Session() session: UserSession<Auth>,
    @Res({ passthrough: true }) response: Response,
  ) {
    assertCanViewUserProfile({
      currentUserId: session.user.id,
      requestedUserId: id,
      role: session.user.role,
    });

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
