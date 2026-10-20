import { createHash, randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  OnApplicationShutdown,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  Prisma,
  type StorageUpload,
  type StorageFile,
  type StorageDocumentType,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StorageObjectService } from './storage-object.service';
import { StorageFilePolicyService } from './storage-file-policy.service';
import type { StorageFileDocumentRule } from './storage-file-policy.config';
import {
  getSafeExtension,
  normalizeOriginalFileName,
} from './storage-file-names.helper';
import { assertValidStorageFile } from './storage-file.validation';
import { assertStorageOwner } from './storage-owner.validation';
import type { StorageOwnerContext, UploadedFileInput } from './storage.types';

export type StorageUploadScope = { module: string; entityType: string };

@Injectable()
export class StorageStagedUploadService
  implements OnModuleInit, OnApplicationShutdown
{
  private readonly logger = new Logger(StorageStagedUploadService.name);
  private timer?: NodeJS.Timeout;
  private cleanup?: Promise<void>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly objects: StorageObjectService,
    private readonly policy: StorageFilePolicyService,
  ) {}

  onModuleInit() {
    this.timer = setInterval(() => {
      if (!this.cleanup) {
        this.cleanup = this.cleanupExpired()
          .catch((error: unknown) => {
            this.logger.error(
              'Failed to clean staged uploads',
              error instanceof Error ? error.message : String(error),
            );
          })
          .finally(() => {
            this.cleanup = undefined;
          });
      }
    }, 60_000);
    this.timer.unref();
  }

  async onApplicationShutdown() {
    clearInterval(this.timer);
    await this.cleanup;
  }

  async prepare(
    scope: StorageUploadScope,
    actorUserId: string,
    documentType: StorageDocumentType,
    file: UploadedFileInput | undefined,
    rule?: StorageFileDocumentRule,
  ) {
    assertStorageOwner({ ...scope, entityId: 'pending' });
    assertValidStorageFile(file);
    const originalName = normalizeOriginalFileName(file.originalname);
    if (
      originalName.length > 255 ||
      originalName.includes('\0') ||
      !file.mimetype ||
      file.mimetype.length > 128
    )
      throw new BadRequestException({
        code: 'INVALID_STORAGE_FILE',
        message: 'Некорректные сведения о документе.',
      });
    await this.policy.assertFileMatchesDocumentType({
      file,
      documentType,
      rule,
    });
    const id = randomUUID();
    const objectKey = `staged/${id}.${getSafeExtension(file)}`;
    // Keep the cleanup intent even if the process dies during the upload.
    const pending = await this.prisma.storageUpload.create({
      data: {
        id,
        bucket: this.objects.bucket,
        objectKey,
        originalName,
        mimeType: file.mimetype,
        sizeBytes: BigInt(file.buffer.length),
        sha256: createHash('sha256').update(file.buffer).digest('hex'),
        documentType,
        ownerModule: scope.module,
        ownerEntityType: scope.entityType,
        uploadedByUserId: actorUserId,
      },
    });
    try {
      await this.objects.putObject({
        key: objectKey,
        body: file.buffer,
        contentType: file.mimetype,
      });
      await this.prisma.storageUpload.update({
        where: { id },
        data: { uploadedAt: new Date() },
      });
    } catch {
      await this.prisma.storageUpload
        .update({ where: { id }, data: { expiresAt: new Date(0) } })
        .catch(() => undefined);
      throw new ServiceUnavailableException({
        code: 'STORAGE_UPLOAD_FAILED',
        message: 'Не удалось загрузить документ. Повторите загрузку.',
      });
    }
    return {
      uploadId: id,
      originalName,
      sizeBytes: pending.sizeBytes.toString(),
      sha256: pending.sha256,
      expiresAt: pending.expiresAt,
    };
  }

  async lockUploads(
    tx: Prisma.TransactionClient,
    ids: string[],
    scope: StorageUploadScope,
    actorUserId: string,
  ): Promise<StorageUpload[]> {
    if (
      !ids.length ||
      ids.length > 10 ||
      new Set(ids).size !== ids.length ||
      ids.some(
        (id) =>
          typeof id !== 'string' ||
          !/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/.test(id),
      )
    )
      throw new BadRequestException({
        code: 'STORAGE_ATTACHMENTS_INVALID',
        message: 'Укажите от 1 до 10 разных документов.',
      });
    await tx.$queryRaw`SELECT id FROM storage_uploads WHERE id IN (${Prisma.join(ids.map((id) => Prisma.sql`${id}::uuid`))}) ORDER BY id FOR UPDATE`;
    const rows = await tx.storageUpload.findMany({
      where: {
        id: { in: ids },
        ownerModule: scope.module,
        ownerEntityType: scope.entityType,
        uploadedByUserId: actorUserId,
        uploadedAt: { not: null },
      },
      orderBy: { id: 'asc' },
    });
    const clock = await tx.$queryRaw<
      { now: Date }[]
    >`SELECT clock_timestamp() AS now`;
    if (
      rows.length !== ids.length ||
      rows.some((row) => row.expiresAt <= clock[0].now)
    )
      throw new ConflictException({
        code: 'STORAGE_UPLOAD_UNAVAILABLE',
        message:
          'Документ отсутствует, уже использован, принадлежит другой операции или срок загрузки истёк.',
      });
    return rows;
  }

  async attach(
    tx: Prisma.TransactionClient,
    ids: string[],
    owner: StorageOwnerContext,
    actorUserId: string,
    immutable = false,
  ) {
    assertStorageOwner(owner);
    const uploads = await this.lockUploads(tx, ids, owner, actorUserId);
    const files: StorageFile[] = [];
    for (const row of uploads) {
      files.push(
        await tx.storageFile.create({
          data: {
            bucket: row.bucket,
            objectKey: row.objectKey,
            originalName: row.originalName,
            mimeType: row.mimeType,
            sizeBytes: row.sizeBytes,
            documentType: row.documentType,
            ownerModule: owner.module,
            ownerEntityType: owner.entityType,
            ownerEntityId: owner.entityId,
            uploadedByUserId: actorUserId,
            isImmutable: immutable,
          },
        }),
      );
      await tx.storageUpload.delete({ where: { id: row.id } });
    }
    return files;
  }

  async cleanupExpired() {
    const candidates = await this.prisma.$queryRaw<
      { id: string }[]
    >`SELECT id FROM storage_uploads WHERE expires_at <= clock_timestamp() ORDER BY expires_at LIMIT 20`;
    for (const candidate of candidates) {
      try {
        await this.prisma.$transaction(
          async (tx) => {
            const rows = await tx.$queryRaw<
              { id: string }[]
            >`SELECT id FROM storage_uploads WHERE id = ${candidate.id}::uuid AND expires_at <= clock_timestamp() FOR UPDATE SKIP LOCKED`;
            if (!rows.length) return;
            const row = await tx.storageUpload.findUniqueOrThrow({
              where: { id: candidate.id },
            });
            await this.objects.deleteObject(row.objectKey, row.bucket);
            await tx.storageUpload.delete({ where: { id: row.id } });
          },
          { timeout: 30_000 },
        );
      } catch (error) {
        this.logger.warn(
          `Staged upload cleanup will retry: ${candidate.id}; ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
  }
}
