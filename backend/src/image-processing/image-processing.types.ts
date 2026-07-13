import type { FitEnum, Gravity } from 'sharp';

export type ImageProcessingVersion<Size extends string = string> = {
  fit?: keyof FitEnum;
  height?: number;
  position?: keyof Gravity | 'attention' | 'entropy';
  quality: number;
  size: Size;
  width: number;
  withoutEnlargement?: boolean;
};

export type ImageProcessingConstraints = {
  maxFileSizeBytes: number;
  maxPixelCount: number;
  minShortSidePx: number;
};

export type ProcessedImageVersion<Size extends string = string> = {
  buffer: Buffer;
  contentType: 'image/webp';
  size: Size;
};
