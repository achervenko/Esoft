import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { StorageOwnerContext } from './storage.types';

@Injectable()
export class StorageOwnerLockService {
  lock(tx: Prisma.TransactionClient, owner: StorageOwnerContext) {
    const key = [
      'storage_files',
      owner.module,
      owner.entityType,
      owner.entityId,
    ].join(':');

    return tx.$queryRaw<Array<{ locked: number }>>`
      SELECT 1 AS locked
      FROM (
        SELECT pg_advisory_xact_lock(hashtext(${key}))
      ) AS storage_owner_lock
    `;
  }
}
