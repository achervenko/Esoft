import { StorageDocumentType } from '@prisma/client';

const DISPLAY_NAME_PREFIXES: Record<StorageDocumentType, string> = {
  [StorageDocumentType.passport]: 'Паспорт',
  [StorageDocumentType.maintenance_instruction]: 'Инструкция_по_обслуживанию',
  [StorageDocumentType.equipment_photo]: 'Фото_оборудования',
  [StorageDocumentType.supporting_document]: 'Сопроводительный_документ',
};

export function createEquipmentDocumentDisplayName(params: {
  documentType: StorageDocumentType;
  equipmentId: number;
  extension: string;
}) {
  const extension = normalizeDisplayExtension(params.extension);

  return `${DISPLAY_NAME_PREFIXES[params.documentType]}_${params.equipmentId}.${extension}`;
}

function normalizeDisplayExtension(extension: string) {
  const cleanExtension = extension.trim().replace(/^\.+/, '').toLowerCase();

  return cleanExtension || 'bin';
}
