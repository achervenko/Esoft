import { BadRequestException, ConflictException } from '@nestjs/common';
import type { StorageOwnerContext } from './storage.types';

export function assertStorageOwner(owner: StorageOwnerContext) {
  if (
    !owner ||
    !/^[a-z0-9_-]{1,64}$/.test(owner.module) ||
    !/^[a-z0-9_-]{1,64}$/.test(owner.entityType) ||
    typeof owner.entityId !== 'string' ||
    !owner.entityId ||
    owner.entityId.length > 128 ||
    owner.entityId.includes('\0')
  )
    throw new BadRequestException({
      code: 'STORAGE_OWNER_INVALID',
      message: 'Некорректный владелец файла.',
    });
}

export function assertStorageFileMutable(file: { isImmutable: boolean }) {
  if (file.isImmutable)
    throw new ConflictException({
      code: 'STORAGE_FILE_IMMUTABLE',
      message: 'Документ проведённой операции нельзя изменять или удалять.',
    });
}
