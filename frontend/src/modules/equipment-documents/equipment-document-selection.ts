import type { StorageDocumentType } from "../../shared/api/equipment-files/equipment-files.types";

export type SelectedEquipmentDocumentFiles = Partial<
  Record<StorageDocumentType, File | null>
>;

export function getSelectedDocumentEntries(
  selectedFiles: SelectedEquipmentDocumentFiles,
) {
  return Object.entries(selectedFiles).filter(
    (entry): entry is [StorageDocumentType, File] => Boolean(entry[1]),
  );
}

export function hasSelectedDocumentFiles(
  selectedFiles: SelectedEquipmentDocumentFiles,
) {
  return getSelectedDocumentEntries(selectedFiles).length > 0;
}
