import { Injectable, Logger } from '@nestjs/common';
import { StorageObjectService } from '../storage/storage-object.service';
import {
  UploadedUserPhotoObject,
  UserPhotoUploadPlanItem,
} from './user-photo-upload-plan';

export class UserPhotoObjectUploadError extends Error {
  constructor(
    readonly uploadedObjects: UploadedUserPhotoObject[],
    readonly cause: unknown,
  ) {
    super('Failed to upload user photo object');
  }
}

@Injectable()
export class UserPhotoStorageService {
  private readonly logger = new Logger(UserPhotoStorageService.name);

  constructor(private readonly storageObjects: StorageObjectService) {}

  get bucket() {
    return this.storageObjects.bucket;
  }

  async uploadObjects(uploadPlan: UserPhotoUploadPlanItem[]) {
    const uploadedObjects: UploadedUserPhotoObject[] = [];

    try {
      for (const version of uploadPlan) {
        await this.storageObjects.putObject({
          body: version.buffer,
          contentType: version.contentType,
          key: version.key,
        });
        uploadedObjects.push({ key: version.key, size: version.size });
      }
    } catch (error) {
      throw new UserPhotoObjectUploadError(uploadedObjects, error);
    }

    return uploadedObjects;
  }

  async deleteObjectsBestEffort(keys: string[]) {
    const uniqueKeys = [...new Set(keys)];
    const results = await Promise.allSettled(
      uniqueKeys.map((key) => this.storageObjects.deleteObject(key)),
    );

    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        this.logger.warn(
          `Failed to delete orphan user photo object ${uniqueKeys[index]}`,
          result.reason instanceof Error
            ? result.reason.stack
            : String(result.reason),
        );
      }
    });
  }
}
