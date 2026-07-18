import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { UserPhotoSize } from './user-photo-size';
import { PrismaService } from '../prisma/prisma.service';
import { StorageObjectService } from '../storage/storage-object.service';

@Injectable()
export class UserPhotoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storageObjects: StorageObjectService,
  ) {}

  async getPhotoObject(userId: string, size: UserPhotoSize) {
    const photo = await this.prisma.userPhoto.findUnique({
      where: { userId },
    });

    if (!photo) {
      throw new NotFoundException({
        code: 'USER_PHOTO_NOT_FOUND',
        message: 'Фото пользователя не найдено.',
      });
    }

    const keyBySize: Record<UserPhotoSize, string> = {
      large: photo.largeObjectKey,
      medium: photo.mediumObjectKey,
      small: photo.smallObjectKey,
    };

    const objectKey = keyBySize[size];

    if (!objectKey) {
      throw new BadRequestException({
        code: 'UNSUPPORTED_PHOTO_SIZE',
        message: 'Неподдерживаемый размер фото.',
      });
    }

    return this.storageObjects.getObject(objectKey);
  }
}
