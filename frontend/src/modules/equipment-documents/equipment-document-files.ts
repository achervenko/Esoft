import type {
  EquipmentFile,
  StorageDocumentType,
} from "../../shared/api/equipment-files/equipment-files.types";

export function groupEquipmentFilesByDocumentType(
  files: EquipmentFile[],
  documentTypes: StorageDocumentType[],
) {
  return documentTypes.reduce(
    (groups, documentType) => ({
      ...groups,
      [documentType]: files
        .filter((file) => file.documentType === documentType)
        .sort(compareEquipmentFiles),
    }),
    {} as Record<StorageDocumentType, EquipmentFile[]>,
  );
}

function compareEquipmentFiles(left: EquipmentFile, right: EquipmentFile) {
  if (left.isPrimary !== right.isPrimary) {
    return left.isPrimary ? -1 : 1;
  }

  return right.id - left.id;
}
