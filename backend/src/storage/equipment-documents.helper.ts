import { BadRequestException } from '@nestjs/common';
import { StorageDocumentType } from '@prisma/client';

const DISPLAY_NAME_PREFIXES: Partial<Record<StorageDocumentType, string>> = {
  [StorageDocumentType.passport]: 'Паспорт',
  [StorageDocumentType.maintenance_instruction]: 'Инструкция_по_обслуживанию',
  [StorageDocumentType.equipment_photo]: 'Фото_оборудования',
};

export function createEquipmentDocumentDisplayName(params: {
  documentType: StorageDocumentType;
  equipmentId: number;
  extension: string;
}) {
  const extension = normalizeDisplayExtension(params.extension);
  const prefix = DISPLAY_NAME_PREFIXES[params.documentType];

  if (!prefix) {
    throw new BadRequestException(
      'Для этого типа документа отображаемое имя не генерируется.',
    );
  }

  return `${prefix}_${params.equipmentId}.${extension}`;
}

function normalizeDisplayExtension(extension: string) {
  const cleanExtension = extension.trim().replace(/^\.+/, '').toLowerCase();

  return cleanExtension || 'bin';
}
