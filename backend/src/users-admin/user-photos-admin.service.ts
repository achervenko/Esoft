import { Injectable, InternalServerErrorException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { UploadedFileInput } from '../storage/storage.types';
import { getUserPhotoObjectKeys } from '../users/user-photo-object-keys';
import { throwUserAdminNotFound } from './users-admin.errors';
import { toAdminUserDto } from './users-admin.mapper';
import { UsersAdminAuditService } from './users-admin-audit.service';
import { UserPhotoProcessingService } from './user-photo-processing.service';
import {
  createUserPhotoUploadPlan,
  getUploadedObjectKey,
  UploadedUserPhotoObject,
  withoutKeys,
} from './user-photo-upload-plan';
import {
  UserPhotoObjectUploadError,
  UserPhotoStorageService,
} from './user-photo-storage.service';

type AdminUserWithRelations = Prisma.UserGetPayload<{
  include: typeof adminUserInclude;
}>;

@Injectable()
export class UserPhotosAdminService {
  constructor(
    private readonly audit: UsersAdminAuditService,
    private readonly photoProcessor: UserPhotoProcessingService,
    private readonly prisma: PrismaService,
    private readonly photoStorage: UserPhotoStorageService,
  ) {}

  async uploadPhoto(params: {
    actorUserId?: string | null;
    file: UploadedFileInput | undefined;
    userId: string;
  }) {
    await this.assertUserExists(params.userId);
    const versions = await this.photoProcessor.process(params.file);
    const uploadPlan = createUserPhotoUploadPlan({
      userId: params.userId,
      versions,
    });
    const uploadedObjects: UploadedUserPhotoObject[] = [];
    let replacedPhotoObjectKeys: string[] = [];
    let hadPreviousPhoto = false;

    let savedUser: AdminUserWithRelations;

    try {
      uploadedObjects.push(
        ...(await this.photoStorage.uploadObjects(uploadPlan)),
      );

      savedUser = await this.prisma.$transaction(async (tx) => {
        await this.lockUserPhoto(tx, params.userId);
        const previousPhoto = await tx.userPhoto.findUnique({
          where: { userId: params.userId },
        });
        replacedPhotoObjectKeys = getUserPhotoObjectKeys(previousPhoto);
        hadPreviousPhoto = Boolean(previousPhoto);

        await tx.userPhoto.upsert({
          create: {
            bucket: this.photoStorage.bucket,
            largeObjectKey: getUploadedObjectKey(uploadedObjects, 'large'),
            mediumObjectKey: getUploadedObjectKey(uploadedObjects, 'medium'),
            originalName: params.file?.originalname ?? 'photo',
            smallObjectKey: getUploadedObjectKey(uploadedObjects, 'small'),
            uploadedByUserId: params.actorUserId ?? null,
            userId: params.userId,
          },
          update: {
            bucket: this.photoStorage.bucket,
            largeObjectKey: getUploadedObjectKey(uploadedObjects, 'large'),
            mediumObjectKey: getUploadedObjectKey(uploadedObjects, 'medium'),
            originalName: params.file?.originalname ?? 'photo',
            smallObjectKey: getUploadedObjectKey(uploadedObjects, 'small'),
            uploadedByUserId: params.actorUserId ?? null,
          },
          where: { userId: params.userId },
        });

        const user = await tx.user.findUniqueOrThrow({
          include: adminUserInclude,
          where: { id: params.userId },
        });

        const userDto = toAdminUserDto(user);
        await this.audit.logUserPhotoUploaded({
          actorUserId: params.actorUserId,
          hadPreviousPhoto,
          tx,
          user: userDto,
        });

        return user;
      });
    } catch (error) {
      if (error instanceof UserPhotoObjectUploadError) {
        uploadedObjects.push(...error.uploadedObjects);
      }

      await this.photoStorage.deleteObjectsBestEffort(
        withoutKeys(
          uploadedObjects.map((object) => object.key),
          replacedPhotoObjectKeys,
        ),
      );

      if (uploadedObjects.length < versions.length) {
        throw new InternalServerErrorException({
          code: 'STORAGE_UNAVAILABLE',
          message: 'Хранилище файлов временно недоступно.',
        });
      }

      if (uploadedObjects.length > 0) {
        throw new InternalServerErrorException({
          code: 'USER_PHOTO_UPLOAD_FAILED',
          message:
            'Не удалось сохранить фото пользователя. Изменения отменены.',
        });
      }

      throw error;
    }

    await this.photoStorage.deleteObjectsBestEffort(
      withoutKeys(
        replacedPhotoObjectKeys,
        uploadedObjects.map((object) => object.key),
      ),
    );

    return toAdminUserDto(savedUser);
  }

  async deletePhoto(params: { actorUserId?: string | null; userId: string }) {
    await this.assertUserExists(params.userId);

    const { deletedPhoto, user } = await this.prisma.$transaction(
      async (tx) => {
        await this.lockUserPhoto(tx, params.userId);
        const nextDeletedPhoto = await tx.userPhoto.findUnique({
          where: { userId: params.userId },
        });

        if (nextDeletedPhoto) {
          await tx.userPhoto.delete({
            where: { userId: params.userId },
          });
        }

        const nextUser = await tx.user.findUniqueOrThrow({
          include: adminUserInclude,
          where: { id: params.userId },
        });

        if (nextDeletedPhoto) {
          await this.audit.logUserPhotoDeleted(
            toAdminUserDto(nextUser),
            params.actorUserId,
            tx,
          );
        }

        return {
          deletedPhoto: nextDeletedPhoto,
          user: nextUser,
        };
      },
    );

    if (deletedPhoto) {
      await this.photoStorage.deleteObjectsBestEffort(
        getUserPhotoObjectKeys(deletedPhoto),
      );
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

  private lockUserPhoto(tx: Prisma.TransactionClient, userId: string) {
    return tx.$executeRaw`
      SELECT pg_advisory_xact_lock(hashtext(${'user_photo:' + userId}))
    `;
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
