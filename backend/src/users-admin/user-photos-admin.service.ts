import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
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
  private readonly logger = new Logger(UserPhotosAdminService.name);

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
    const uploadPlan = createUserPhotoUploadPlan({
      userId: params.userId,
      versions,
    });
    const uploadedObjects: UploadedUserPhotoObject[] = [];
    let replacedPhotoObjectKeys: string[] = [];
    let hadPreviousPhoto = false;

    let savedUser: AdminUserWithRelations;

    try {
      for (const version of uploadPlan) {
        await this.storageObjects.putObject({
          body: version.buffer,
          contentType: version.contentType,
          key: version.key,
        });
        uploadedObjects.push({ key: version.key, size: version.size });
      }

      savedUser = await this.prisma.$transaction(async (tx) => {
        await this.lockUserPhoto(tx, params.userId);
        const previousPhoto = await tx.userPhoto.findUnique({
          where: { userId: params.userId },
        });
        replacedPhotoObjectKeys = getUserPhotoObjectKeys(previousPhoto);
        hadPreviousPhoto = Boolean(previousPhoto);

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
      await this.deletePhotoObjectsBestEffort(
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

    await this.deletePhotoObjectsBestEffort(
      withoutKeys(
        replacedPhotoObjectKeys,
        uploadedObjects.map((object) => object.key),
      ),
    );
    const userDto = toAdminUserDto(savedUser);
    await this.logUserPhotoUploadedBestEffort({
      actorUserId: params.actorUserId,
      hadPreviousPhoto,
      user: userDto,
    });

    return userDto;
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

        return {
          deletedPhoto: nextDeletedPhoto,
          user: nextUser,
        };
      },
    );

    if (deletedPhoto) {
      await this.deletePhotoObjectsBestEffort(
        getUserPhotoObjectKeys(deletedPhoto),
      );
      await this.logUserPhotoDeletedBestEffort(
        toAdminUserDto(user),
        params.actorUserId,
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

  private async deletePhotoObjectsBestEffort(keys: string[]) {
    await Promise.allSettled(
      [...new Set(keys)].map((key) => this.storageObjects.deleteObject(key)),
    );
  }

  private lockUserPhoto(tx: Prisma.TransactionClient, userId: string) {
    return tx.$executeRaw`
      SELECT pg_advisory_xact_lock(hashtext(${'user_photo:' + userId}))
    `;
  }

  private async logUserPhotoUploadedBestEffort(params: {
    actorUserId?: string | null;
    hadPreviousPhoto: boolean;
    user: Parameters<UsersAdminAuditService['logUserPhotoUploaded']>[0]['user'];
  }) {
    try {
      await this.audit.logUserPhotoUploaded(params);
    } catch (error) {
      this.logAuditError(error);
    }
  }

  private async logUserPhotoDeletedBestEffort(
    user: Parameters<UsersAdminAuditService['logUserPhotoDeleted']>[0],
    actorUserId?: string | null,
  ) {
    try {
      await this.audit.logUserPhotoDeleted(user, actorUserId);
    } catch (error) {
      this.logAuditError(error);
    }
  }

  private logAuditError(error: unknown) {
    this.logger.error(
      'Failed to write user photo audit log',
      error instanceof Error ? error.stack : String(error),
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
  const key = objects.find((object) => object.size === size)?.key;

  if (!key) {
    throw new InternalServerErrorException({
      code: 'USER_PHOTO_UPLOAD_FAILED',
      message: 'Не удалось подготовить все размеры фото пользователя.',
    });
  }

  return key;
}

function withoutKeys(keys: string[], keysToExclude: string[]) {
  const excludedKeys = new Set(keysToExclude);

  return keys.filter((key) => !excludedKeys.has(key));
}

function createUniqueUserPhotoObjectKey(params: {
  existingKeys: string[];
  size: UserPhotoSize;
  userId: string;
}) {
  const existingKeys = new Set(params.existingKeys);

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const key = createUserPhotoObjectKey(params.userId, params.size);

    if (!existingKeys.has(key)) {
      return key;
    }
  }

  throw new InternalServerErrorException({
    code: 'USER_PHOTO_UPLOAD_FAILED',
    message: 'Не удалось подготовить уникальный ключ фото пользователя.',
  });
}

function createUserPhotoUploadPlan(params: {
  userId: string;
  versions: Array<{
    buffer: Buffer;
    contentType: string;
    size: UserPhotoSize;
  }>;
}) {
  const usedKeys: string[] = [];

  return params.versions.map((version) => {
    const key = createUniqueUserPhotoObjectKey({
      existingKeys: usedKeys,
      size: version.size,
      userId: params.userId,
    });
    usedKeys.push(key);

    return {
      ...version,
      key,
    };
  });
}
