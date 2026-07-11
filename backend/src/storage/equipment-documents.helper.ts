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
      '\u0414\u043b\u044f \u044d\u0442\u043e\u0433\u043e \u0442\u0438\u043f\u0430 \u0434\u043e\u043a\u0443\u043c\u0435\u043d\u0442\u0430 \u043e\u0442\u043e\u0431\u0440\u0430\u0436\u0430\u0435\u043c\u043e\u0435 \u0438\u043c\u044f \u043d\u0435 \u0433\u0435\u043d\u0435\u0440\u0438\u0440\u0443\u0435\u0442\u0441\u044f.',
    );
  }

  return `${prefix}_${params.equipmentId}.${extension}`;
}

function normalizeDisplayExtension(extension: string) {
  const cleanExtension = extension.trim().replace(/^\.+/, '').toLowerCase();

  return cleanExtension || 'bin';
}
