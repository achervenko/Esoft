import {
  initialEquipmentCreateFormState,
  type EquipmentCreateFormState,
} from "./equipment-create-form.types";

const userFields = [
  "name",
  "manufacturerId",
  "modelId",
  "specifications",
  "serialNumber",
  "inventoryNumber",
  "countryId",
  "manufactureYear",
  "commissioningDate",
  "issueDate",
  "sectionId",
  "responsibleEmployeeId",
  "status",
  "operationText",
  "notes",
] as const satisfies readonly (keyof EquipmentCreateFormState)[];

export function isEquipmentCreateFormDirty(
  form: EquipmentCreateFormState,
  baseline: EquipmentCreateFormState = initialEquipmentCreateFormState,
) {
  return userFields.some((field) => form[field] !== baseline[field]);
}
