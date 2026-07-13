import { randomUUID } from 'node:crypto';
import type { UserPhotoSize } from './user-photo-size';

export type UserPhotoObjectKeys = Record<UserPhotoSize, string>;

export function createUserPhotoObjectKey(userId: string, size: UserPhotoSize) {
  return `users/${userId}/photo/${size}/${randomUUID()}.webp`;
}

export function getUserPhotoObjectKeys(
  photo:
    | {
        largeObjectKey: string;
        mediumObjectKey: string;
        smallObjectKey: string;
      }
    | null
    | undefined,
) {
  if (!photo) {
    return [];
  }

  return [photo.largeObjectKey, photo.mediumObjectKey, photo.smallObjectKey];
}
