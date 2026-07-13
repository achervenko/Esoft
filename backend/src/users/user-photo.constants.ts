export const userPhotoConstraints = {
  maxFileSizeBytes: 10 * 1024 * 1024,
  maxPixelCount: 25_000_000,
  minShortSidePx: 512,
};

export const userPhotoVersions = [
  { fit: 'cover', height: 1024, quality: 86, size: 'large', width: 1024 },
  { fit: 'cover', height: 256, quality: 82, size: 'medium', width: 256 },
  { fit: 'cover', height: 48, quality: 78, size: 'small', width: 48 },
] as const;
