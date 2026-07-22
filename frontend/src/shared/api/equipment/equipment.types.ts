export type EquipmentStatus =
  | "ACTIVE"
  | "RESERVE"
  | "REPAIR"
  | "MAINTENANCE"
  | "WRITTEN_OFF";

export type OptionItem = {
  id: number;
  manufacturerId?: number;
  name: string;
  position?: string;
};

export type EquipmentStatusOption = {
  label: string;
  value: EquipmentStatus;
};

export type EquipmentCreateOptions = {
  countries: OptionItem[];
  employees: OptionItem[];
  manufacturers: OptionItem[];
  models: OptionItem[];
  nextVisibleId: number;
  sections: OptionItem[];
  statuses: EquipmentStatusOption[];
};

export type CreateEquipmentPayload = {
  visibleId?: number;
  name: string;
  modelId: number;
  specifications?: string | null;
  serialNumber?: string | null;
  inventoryNumber: string;
  countryId?: number | null;
  manufactureYear?: number | null;
  commissioningDate?: string | null;
  issueDate?: string | null;
  sectionId: number;
  responsibleEmployeeId: number;
  status: EquipmentStatus;
  operationText?: string | null;
  notes?: string | null;
};

export type UpdateEquipmentPayload = CreateEquipmentPayload;

export type EquipmentRegistryItem = {
  id: number;
  inventoryNumber: string;
  manufacturer: string;
  model: string;
  name: string;
  serialNumber: string | null;
  status: EquipmentStatus;
  statusLabel: string;
  visibleId: number;
};

export type EquipmentCard = {
  commissioningDate: string | null;
  countryId: number | null;
  country: string;
  id: number;
  inventoryNumber: string;
  issueDate: string | null;
  location: string;
  manufacturer: string;
  manufactureYear: number | null;
  modelId: number;
  model: string;
  name: string;
  notes: string | null;
  operationText: string | null;
  responsible: string;
  responsibleEmployeeId: number;
  responsiblePosition: string;
  sectionId: number;
  serialNumber: string | null;
  specifications: string | null;
  status: EquipmentStatus;
  statusLabel: string;
  visibleId: number;
};

export type EquipmentHistoryItem = {
  action: string;
  createdAt: string;
  fieldName: string | null;
  id: number;
  newValue: string | null;
  oldValue: string | null;
  timeZone: string;
  user: string;
};
