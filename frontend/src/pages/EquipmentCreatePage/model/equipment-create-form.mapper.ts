import type {
  CreateEquipmentPayload,
  EquipmentCard,
  EquipmentCreateOptions,
} from "../../../shared/api/equipment/equipment.types";
import type { EquipmentCreateFormState } from "./equipment-create-form.types";

export function toEquipmentCreatePayload(
  form: EquipmentCreateFormState,
): CreateEquipmentPayload {
  return {
    visibleId: toOptionalNumber(form.visibleId),
    name: form.name.trim(),
    modelId: toRequiredNumber(form.modelId, "Модель"),
    specifications: toOptionalText(form.specifications),
    serialNumber: toOptionalText(form.serialNumber),
    inventoryNumber: form.inventoryNumber.trim(),
    countryId: form.countryId,
    manufactureYear: toOptionalNumber(form.manufactureYear) ?? null,
    commissioningDate: toOptionalText(form.commissioningDate),
    issueDate: toOptionalText(form.issueDate),
    sectionId: toRequiredNumber(form.sectionId, "Местонахождение"),
    responsibleEmployeeId: toRequiredNumber(
      form.responsibleEmployeeId,
      "Ответственный",
    ),
    status: form.status,
    operationText: toOptionalText(form.operationText),
    notes: toOptionalText(form.notes),
  };
}

export function toEquipmentFormState(
  equipment: EquipmentCard,
  options: Pick<EquipmentCreateOptions, "models">,
): EquipmentCreateFormState {
  const manufacturerId =
    options.models.find((model) => model.id === equipment.modelId)
      ?.manufacturerId ?? null;

  return {
    visibleId: String(equipment.visibleId),
    name: equipment.name,
    manufacturerId,
    modelId: equipment.modelId,
    specifications: equipment.specifications ?? "",
    serialNumber: equipment.serialNumber ?? "",
    inventoryNumber: equipment.inventoryNumber,
    countryId: equipment.countryId,
    manufactureYear: equipment.manufactureYear
      ? String(equipment.manufactureYear)
      : "",
    commissioningDate: toRuDateInput(equipment.commissioningDate),
    issueDate: toRuDateInput(equipment.issueDate),
    sectionId: equipment.sectionId,
    responsibleEmployeeId: equipment.responsibleEmployeeId,
    status: equipment.status,
    operationText: equipment.operationText ?? "",
    notes: equipment.notes ?? "",
  };
}

function toOptionalNumber(value: string) {
  const cleanValue = value.trim();
  return cleanValue ? Number(cleanValue) : undefined;
}

function toRequiredNumber(value: number | null, label: string) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`Поле "${label}" обязательно.`);
  }

  return value;
}

function toOptionalText(value: string) {
  const cleanValue = value.trim();
  return cleanValue || null;
}

function toRuDateInput(value: string | null) {
  if (!value) {
    return "";
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);

  if (!match) {
    return "";
  }

  const [, year, month, day] = match;

  return `${day}.${month}.${year}`;
}
