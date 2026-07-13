export const userPhotoSizes = ['small', 'medium', 'large'] as const;

export type UserPhotoSize = (typeof userPhotoSizes)[number];

export function isUserPhotoSize(value: string): value is UserPhotoSize {
  return userPhotoSizes.includes(value as UserPhotoSize);
}
