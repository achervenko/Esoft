import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { Inject, Injectable } from '@nestjs/common';
import { Readable } from 'node:stream';
import type { StorageConfig } from './config/storage-config.type';
import { S3_CLIENT, STORAGE_CONFIG } from './storage.tokens';
import type { PutObjectInput, StoredObject } from './storage.types';

@Injectable()
export class StorageObjectService {
  constructor(
    @Inject(S3_CLIENT)
    private readonly s3Client: S3Client,
    @Inject(STORAGE_CONFIG)
    private readonly config: StorageConfig,
  ) {}

  get bucket() {
    return this.config.bucket;
  }

  async assertBucketAvailable() {
    await this.s3Client.send(
      new HeadBucketCommand({
        Bucket: this.config.bucket,
      }),
    );
  }

  async putObject(input: PutObjectInput) {
    await this.s3Client.send(
      new PutObjectCommand({
        Body: input.body,
        Bucket: this.config.bucket,
        ContentType: input.contentType,
        Key: input.key,
      }),
    );

    return {
      bucket: this.config.bucket,
      key: input.key,
    };
  }

  async getObject(key: string): Promise<StoredObject> {
    const response = await this.s3Client.send(
      new GetObjectCommand({
        Bucket: this.config.bucket,
        Key: key,
      }),
    );

    if (!response.Body || !isReadableStream(response.Body)) {
      throw new Error(`Storage object body is empty: ${key}`);
    }

    return {
      body: response.Body,
      contentLength: response.ContentLength,
      contentType: response.ContentType,
    };
  }

  async getObjectOrNull(key: string): Promise<StoredObject | null> {
    try {
      return await this.getObject(key);
    } catch (error) {
      if (isMissingObjectError(error)) {
        return null;
      }

      throw error;
    }
  }

  async deleteObject(key: string) {
    await this.s3Client.send(
      new DeleteObjectCommand({
        Bucket: this.config.bucket,
        Key: key,
      }),
    );
  }
}

function isReadableStream(value: unknown): value is Readable {
  return value instanceof Readable;
}

function isMissingObjectError(error: unknown) {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const namedError = error as { Code?: string; name?: string };
  return ['NoSuchKey', 'NotFound'].includes(
    namedError.name ?? namedError.Code ?? '',
  );
}
