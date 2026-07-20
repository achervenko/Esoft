import { InternalServerErrorException } from '@nestjs/common';
import { createUserPhotoObjectKey } from '../users/user-photo-object-keys';
import type { UserPhotoSize } from '../users/user-photo-size';

export type UserPhotoVersionInput = {
  buffer: Buffer;
  contentType: string;
  size: UserPhotoSize;
};

export type UserPhotoUploadPlanItem = UserPhotoVersionInput & {
  key: string;
};

export type UploadedUserPhotoObject = {
  key: string;
  size: UserPhotoSize;
};

export function createUserPhotoUploadPlan(params: {
  userId: string;
  versions: UserPhotoVersionInput[];
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

export function getUploadedObjectKey(
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

export function withoutKeys(keys: string[], keysToExclude: string[]) {
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
