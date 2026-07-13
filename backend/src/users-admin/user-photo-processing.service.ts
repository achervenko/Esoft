import { Injectable } from '@nestjs/common';
import { ImageProcessingService } from '../image-processing/image-processing.service';
import type { UploadedFileInput } from '../storage/storage.types';
import {
  userPhotoConstraints,
  userPhotoVersions,
} from '../users/user-photo.constants';

@Injectable()
export class UserPhotoProcessingService {
  constructor(private readonly imageProcessing: ImageProcessingService) {}

  process(file: UploadedFileInput | undefined) {
    return this.imageProcessing.createWebpVersions({
      constraints: userPhotoConstraints,
      file,
      versions: userPhotoVersions,
    });
  }
}
