export type StorageDocumentType =
  | "passport"
  | "maintenance_instruction"
  | "equipment_photo"
  | "supporting_document";

export type EquipmentFile = {
  createdAt: string;
  deletedAt: string | null;
  displayName: string;
  documentType: StorageDocumentType;
  id: number;
  isPrimary: boolean;
  mimeType: string;
  originalName: string;
  sizeBytes: string;
};
