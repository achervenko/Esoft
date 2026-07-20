import { Injectable } from '@nestjs/common';
import type { StorageFile } from '@prisma/client';
import { StorageDocumentType } from '@prisma/client';
import {
  createStorageFileBadRequest,
  isSingleStorageDocumentType,
} from './storage-file.validation';

@Injectable()
export class StorageFileUploadPolicyService {
  assertDocumentCanBeAdded(params: {
    activeFiles: StorageFile[];
    documentType: StorageDocumentType;
  }) {
    if (!isSingleStorageDocumentType(params.documentType)) {
      return;
    }

    const hasActiveDocument = params.activeFiles.some(
      (file) => file.documentType === params.documentType,
    );

    if (hasActiveDocument) {
      throw createStorageFileBadRequest(
        'DOCUMENT_ALREADY_EXISTS',
        'Паспорт для этого оборудования уже загружен. Удалите его перед загрузкой нового.',
      );
    }
  }

  shouldMakePrimary(params: {
    activeFiles: StorageFile[];
    documentType: StorageDocumentType;
  }) {
    if (params.documentType !== StorageDocumentType.equipment_photo) {
      return false;
    }

    return !params.activeFiles.some(
      (file) => file.documentType === StorageDocumentType.equipment_photo,
    );
  }
}
