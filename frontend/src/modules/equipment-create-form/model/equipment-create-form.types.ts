import type { FieldErrors, ValidationResult } from "../../../shared/lib/form-validation";

export type EquipmentCreateFormState = {
  visibleId: string;
  name: string;
  manufacturerId: number | null;
  modelId: number | null;
  specifications: string;
  serialNumber: string;
  inventoryNumber: string;
  countryId: number | null;
  manufactureYear: string;
  commissioningDate: string;
  issueDate: string;
  sectionId: number | null;
  responsibleEmployeeId: number | null;
  status: string;
  operationText: string;
  notes: string;
};

export type EquipmentCreateFormField = keyof EquipmentCreateFormState;

export type EquipmentCreateFieldErrors = FieldErrors<EquipmentCreateFormState>;

export type EquipmentCreateValidationResult =
  ValidationResult<EquipmentCreateFormState>;

export const initialEquipmentCreateFormState: EquipmentCreateFormState = {
  visibleId: "",
  name: "",
  manufacturerId: null,
  modelId: null,
  specifications: "",
  serialNumber: "",
  inventoryNumber: "",
  countryId: null,
  manufactureYear: "",
  commissioningDate: "",
  issueDate: "",
  sectionId: null,
  responsibleEmployeeId: null,
  status: "",
  operationText: "",
  notes: "",
};
