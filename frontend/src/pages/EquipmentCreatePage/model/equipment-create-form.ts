import type { CreateEquipmentPayload } from '../../../shared/api/equipment-api';
import {
  isBlank,
  isInvalidRuDate,
  isLongerThan,
  isNotPositiveInteger,
  isYearOutsideRange,
  validateForm,
  type FieldErrors,
  type ValidationResult,
  type ValidationRule,
} from '../../../shared/lib/form-validation';

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

export type EquipmentCreateFormField = keyof EquipmentCreateFormState;

export type EquipmentCreateFieldErrors = FieldErrors<EquipmentCreateFormState>;

export type EquipmentCreateValidationResult =
  ValidationResult<EquipmentCreateFormState>;

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
  status: '',
  operationText: '',
  notes: '',
};

const maxManufactureYear = new Date().getFullYear() + 1;

const equipmentCreateValidationRules: ValidationRule<EquipmentCreateFormState>[] =
  [
    {
      field: 'visibleId',
      message: 'ID должен быть положительным целым числом.',
      trigger: (form) => isNotPositiveInteger(form.visibleId),
    },
    {
      field: 'name',
      message: 'Укажите название оборудования.',
      trigger: (form) => isBlank(form.name),
    },
    {
      field: 'name',
      message: 'Название оборудования: максимум 128 символов.',
      trigger: (form) => isLongerThan(form.name, 128),
    },
    {
      field: 'inventoryNumber',
      message: 'Укажите инвентарный номер.',
      trigger: (form) => isBlank(form.inventoryNumber),
    },
    {
      field: 'inventoryNumber',
      message: 'Инвентарный номер: максимум 64 символа.',
      trigger: (form) => isLongerThan(form.inventoryNumber, 64),
    },
    {
      field: 'serialNumber',
      message: 'Заводской номер: максимум 128 символов.',
      trigger: (form) => isLongerThan(form.serialNumber, 128),
    },
    {
      field: 'model',
      message: 'Модель: максимум 128 символов.',
      trigger: (form) => isLongerThan(form.model, 128),
    },
    {
      field: 'manufactureYear',
      message: `Год выпуска должен быть от 1900 до ${maxManufactureYear}.`,
      trigger: (form) =>
        isYearOutsideRange(form.manufactureYear, 1900, maxManufactureYear),
    },
    {
      field: 'commissioningDate',
      message: 'Введите реальную дату в формате ДД.ММ.ГГГГ.',
      trigger: (form) => isInvalidRuDate(form.commissioningDate),
    },
    {
      field: 'sectionId',
      message: 'Выберите местонахождение из списка.',
      trigger: (form) => !form.sectionId,
    },
    {
      field: 'responsibleEmployeeId',
      message: 'Выберите ответственного из списка.',
      trigger: (form) => !form.responsibleEmployeeId,
    },
    {
      field: 'status',
      message: 'Выберите статус.',
      trigger: (form) => isBlank(form.status),
    },
  ];

export function formatRuDate(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 8);
  const parts = [
    digits.slice(0, 2),
    digits.slice(2, 4),
    digits.slice(4, 8),
  ].filter(Boolean);

  return parts.join('.');
}

export function validateEquipmentCreateForm(
  form: EquipmentCreateFormState,
): EquipmentCreateValidationResult {
  return validateForm(form, equipmentCreateValidationRules);
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
