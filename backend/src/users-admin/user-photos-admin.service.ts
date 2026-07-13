import { Injectable, InternalServerErrorException } from '@nestjs/common';
import type { Prisma, UserPhoto } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StorageObjectService } from '../storage/storage-object.service';
import type { UploadedFileInput } from '../storage/storage.types';
import {
  createUserPhotoObjectKey,
  getUserPhotoObjectKeys,
} from '../users/user-photo-object-keys';
import type { UserPhotoSize } from '../users/user-photo-size';
import { throwUserAdminNotFound } from './users-admin.errors';
import { toAdminUserDto } from './users-admin.mapper';
import { UsersAdminAuditService } from './users-admin-audit.service';
import { UserPhotoProcessingService } from './user-photo-processing.service';

type UploadedUserPhotoObject = {
  key: string;
  size: UserPhotoSize;
};

type AdminUserWithRelations = Prisma.UserGetPayload<{
  include: typeof adminUserInclude;
}>;

@Injectable()
export class UserPhotosAdminService {
  constructor(
    private readonly audit: UsersAdminAuditService,
    private readonly photoProcessor: UserPhotoProcessingService,
    private readonly prisma: PrismaService,
    private readonly storageObjects: StorageObjectService,
  ) {}

  async uploadPhoto(params: {
    actorUserId?: string | null;
    file: UploadedFileInput | undefined;
    userId: string;
  }) {
    await this.assertUserExists(params.userId);
    const versions = await this.photoProcessor.process(params.file);
    const uploadedObjects: UploadedUserPhotoObject[] = [];

    let savedUser: AdminUserWithRelations;
    let previousPhoto: UserPhoto | null = null;

    try {
      for (const version of versions) {
        const key = createUserPhotoObjectKey(params.userId, version.size);
        await this.storageObjects.putObject({
          body: version.buffer,
          contentType: version.contentType,
          key,
        });
        uploadedObjects.push({ key, size: version.size });
      }

      previousPhoto = await this.prisma.userPhoto.findUnique({
        where: { userId: params.userId },
      });
      savedUser = await this.prisma.$transaction(async (tx) => {
        await tx.userPhoto.upsert({
          create: {
            bucket: this.storageObjects.bucket,
            largeObjectKey: getUploadedObjectKey(uploadedObjects, 'large'),
            mediumObjectKey: getUploadedObjectKey(uploadedObjects, 'medium'),
            originalName: params.file?.originalname ?? 'photo',
            smallObjectKey: getUploadedObjectKey(uploadedObjects, 'small'),
            uploadedByUserId: params.actorUserId ?? null,
            userId: params.userId,
          },
          update: {
            bucket: this.storageObjects.bucket,
            largeObjectKey: getUploadedObjectKey(uploadedObjects, 'large'),
            mediumObjectKey: getUploadedObjectKey(uploadedObjects, 'medium'),
            originalName: params.file?.originalname ?? 'photo',
            smallObjectKey: getUploadedObjectKey(uploadedObjects, 'small'),
            uploadedByUserId: params.actorUserId ?? null,
          },
          where: { userId: params.userId },
        });

        return tx.user.findUniqueOrThrow({
          include: adminUserInclude,
          where: { id: params.userId },
        });
      });
    } catch (error) {
      await this.deletePhotoObjectsBestEffort(uploadedObjects.map((object) => object.key));

      if (uploadedObjects.length < versions.length) {
        throw new InternalServerErrorException({
          code: 'STORAGE_UNAVAILABLE',
          message: 'Хранилище файлов временно недоступно.',
        });
      }

      if (uploadedObjects.length > 0) {
        throw new InternalServerErrorException({
          code: 'USER_PHOTO_UPLOAD_FAILED',
          message: 'Не удалось сохранить фото пользователя. Изменения отменены.',
        });
      }

      throw error;
    }

    await this.deletePhotoObjectsBestEffort(getUserPhotoObjectKeys(previousPhoto));
    const userDto = toAdminUserDto(savedUser);
    await this.audit.logUserPhotoUploaded(userDto, params.actorUserId);

    return userDto;
  }

  async deletePhoto(params: { actorUserId?: string | null; userId: string }) {
    await this.assertUserExists(params.userId);
    const previousPhoto = await this.prisma.userPhoto.findUnique({
      where: { userId: params.userId },
    });

    const user = await this.prisma.$transaction(async (tx) => {
      if (previousPhoto) {
        await tx.userPhoto.delete({
          where: { userId: params.userId },
        });
      }

      return tx.user.findUniqueOrThrow({
        include: adminUserInclude,
        where: { id: params.userId },
      });
    });

    if (previousPhoto) {
      await this.deletePhotoObjectsBestEffort(getUserPhotoObjectKeys(previousPhoto));
      await this.audit.logUserPhotoDeleted(toAdminUserDto(user), params.actorUserId);
    }

    return toAdminUserDto(user);
  }

  private async assertUserExists(userId: string) {
    const user = await this.prisma.user.findUnique({
      select: { id: true },
      where: { id: userId },
    });

    if (!user) {
      throwUserAdminNotFound('USER_NOT_FOUND');
    }
  }

  private async deletePhotoObjectsBestEffort(keys: string[]) {
    await Promise.allSettled(
      [...new Set(keys)].map((key) => this.storageObjects.deleteObject(key)),
    );
  }
}

const adminUserInclude = {
  employeeUser: {
    include: {
      employee: true,
    },
  },
  photo: true,
  sessions: {
    orderBy: { createdAt: 'desc' as const },
    select: { createdAt: true },
    take: 1,
  },
};

function getUploadedObjectKey(
  objects: UploadedUserPhotoObject[],
  size: UploadedUserPhotoObject['size'],
) {
  return objects.find((object) => object.size === size)?.key ?? '';
}
