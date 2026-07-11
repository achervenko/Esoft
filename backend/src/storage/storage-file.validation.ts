import { BadRequestException } from '@nestjs/common';
import { StorageDocumentType } from '@prisma/client';
import type { UploadedFileInput } from './storage.types';

const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024;

export function assertValidStorageFile(file: UploadedFileInput) {
  if (!file?.buffer || file.size <= 0) {
    throw new BadRequestException(
      '\u0424\u0430\u0439\u043b \u043f\u0443\u0441\u0442\u043e\u0439 \u0438\u043b\u0438 \u043d\u0435 \u043f\u0435\u0440\u0435\u0434\u0430\u043d.',
    );
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new BadRequestException(
      '\u0420\u0430\u0437\u043c\u0435\u0440 \u0444\u0430\u0439\u043b\u0430 \u043d\u0435 \u0434\u043e\u043b\u0436\u0435\u043d \u043f\u0440\u0435\u0432\u044b\u0448\u0430\u0442\u044c 25 \u041c\u0411.',
    );
  }
}

export function assertValidStorageDocumentType(
  documentType: StorageDocumentType,
) {
  if (!isStorageDocumentType(documentType)) {
    throw new BadRequestException(
      '\u041d\u0435\u043a\u043e\u0440\u0440\u0435\u043a\u0442\u043d\u044b\u0439 \u0442\u0438\u043f \u0434\u043e\u043a\u0443\u043c\u0435\u043d\u0442\u0430.',
    );
  }
}

function isStorageDocumentType(value: unknown): value is StorageDocumentType {
  return (
    typeof value === 'string' &&
    (Object.values(StorageDocumentType) as string[]).includes(value)
  );
}
