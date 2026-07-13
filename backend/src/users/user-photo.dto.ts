type UserPhotoForDto = {
  updatedAt: Date;
  userId: string;
};

export type UserPhotoDto = {
  largeUrl: string;
  mediumUrl: string;
  smallUrl: string;
  updatedAt: Date;
};

export function toUserPhotoDto(
  photo: UserPhotoForDto | null | undefined,
): UserPhotoDto | null {
  if (!photo) {
    return null;
  }

  const version = encodeURIComponent(photo.updatedAt.toISOString());
  const userId = encodeURIComponent(photo.userId);

  return {
    largeUrl: `/api/users/${userId}/photo/large?v=${version}`,
    mediumUrl: `/api/users/${userId}/photo/medium?v=${version}`,
    smallUrl: `/api/users/${userId}/photo/small?v=${version}`,
    updatedAt: photo.updatedAt,
  };
}
