import type { CreateEquipmentPayload } from '../../../shared/api/equipment-api';

export type EquipmentCreateFormState = {
  visibleId: string;
  name: string;
  manufacturerId: number | null;
  model: string;
  specifications: string;
  serialNumber: string;
  inventoryNumber: string;
  countryId: number | null;
  manufactureYear: string;
  commissioningDate: string;
  sectionId: number | null;
  responsibleEmployeeId: number | null;
  status: string;
  operationText: string;
  notes: string;
};

export const initialEquipmentCreateFormState: EquipmentCreateFormState = {
  visibleId: '',
  name: '',
  manufacturerId: null,
  model: '',
  specifications: '',
  serialNumber: '',
  inventoryNumber: '',
  countryId: null,
  manufactureYear: '',
  commissioningDate: '',
  sectionId: null,
  responsibleEmployeeId: null,
  status: 'ACTIVE',
  operationText: '',
  notes: '',
};

export function formatRuDate(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 8);
  const parts = [
    digits.slice(0, 2),
    digits.slice(2, 4),
    digits.slice(4, 8),
  ].filter(Boolean);

  return parts.join('.');
}

export function validateEquipmentCreateForm(form: EquipmentCreateFormState) {
  if (!form.name.trim()) {
    return 'Укажите название оборудования.';
  }

  if (!form.inventoryNumber.trim()) {
    return 'Укажите инвентарный номер.';
  }

  if (!form.sectionId) {
    return 'Выберите местонахождение.';
  }

  if (!form.responsibleEmployeeId) {
    return 'Выберите ответственного.';
  }

  if (!form.status) {
    return 'Выберите статус.';
  }

  return null;
}

export function toEquipmentCreatePayload(
  form: EquipmentCreateFormState,
): CreateEquipmentPayload {
  return {
    visibleId: toOptionalNumber(form.visibleId),
    name: form.name.trim(),
    manufacturerId: form.manufacturerId,
    model: toOptionalText(form.model),
    specifications: toOptionalText(form.specifications),
    serialNumber: toOptionalText(form.serialNumber),
    inventoryNumber: form.inventoryNumber.trim(),
    countryId: form.countryId,
    manufactureYear: toOptionalNumber(form.manufactureYear) ?? null,
    commissioningDate: toOptionalText(form.commissioningDate),
    sectionId: toRequiredNumber(form.sectionId, 'Местонахождение'),
    responsibleEmployeeId: toRequiredNumber(
      form.responsibleEmployeeId,
      'Ответственный',
    ),
    status: form.status,
    operationText: toOptionalText(form.operationText),
    notes: toOptionalText(form.notes),
  };
}

function toOptionalNumber(value: string) {
  const cleanValue = value.trim();
  return cleanValue ? Number(cleanValue) : undefined;
}

function toRequiredNumber(value: number | null, label: string) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`Поле "${label}" обязательно.`);
  }

  return value;
}

function toOptionalText(value: string) {
  const cleanValue = value.trim();
  return cleanValue || null;
}
