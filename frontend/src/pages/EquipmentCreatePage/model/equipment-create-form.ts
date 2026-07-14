import type {
  CreateEquipmentPayload,
  EquipmentCard,
} from '../../../shared/api/equipment-api';
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
  visibleId: '',
  name: '',
  manufacturerId: null,
  modelId: null,
  specifications: '',
  serialNumber: '',
  inventoryNumber: '',
  countryId: null,
  manufactureYear: '',
  commissioningDate: '',
  issueDate: '',
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
      field: 'manufacturerId',
      message: 'Выберите производителя из списка.',
      trigger: (form) => !form.manufacturerId,
    },
    {
      field: 'modelId',
      message: 'Выберите модель из списка.',
      trigger: (form) => !form.modelId,
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
      field: 'issueDate',
      message: 'Укажите дату выдачи при назначении ответственного.',
      trigger: (form) =>
        Boolean(form.responsibleEmployeeId) && isBlank(form.issueDate),
    },
    {
      field: 'issueDate',
      message: 'Введите реальную дату выдачи в формате ДД.ММ.ГГГГ.',
      trigger: (form) => isInvalidRuDate(form.issueDate),
    },
    {
      field: 'issueDate',
      message: 'Дата выдачи не может быть раньше даты ввода в эксплуатацию.',
      trigger: (form) =>
        isRuDateBefore(form.issueDate, form.commissioningDate),
    },
    {
      field: 'commissioningDate',
      message:
        'Год ввода в эксплуатацию не может быть меньше года выпуска.',
      trigger: (form) =>
        isCommissioningYearBeforeManufactureYear(
          form.commissioningDate,
          form.manufactureYear,
        ),
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

export function getEquipmentFieldErrorsFromMessage(message: string) {
  const lowerMessage = message.toLowerCase();
  const fieldErrors: EquipmentCreateFieldErrors = {};

  if (lowerMessage.includes('id')) {
    fieldErrors.visibleId = message;
  }

  if (lowerMessage.includes('дата выдачи')) {
    fieldErrors.issueDate = message;
  }

  if (lowerMessage.includes('год ввода')) {
    fieldErrors.commissioningDate = message;
  }

  if (lowerMessage.includes('производител')) {
    fieldErrors.manufacturerId = message;
  }

  if (lowerMessage.includes('модел')) {
    fieldErrors.modelId = message;
  }

  return fieldErrors;
}

export function toEquipmentCreatePayload(
  form: EquipmentCreateFormState,
): CreateEquipmentPayload {
  return {
    visibleId: toOptionalNumber(form.visibleId),
    name: form.name.trim(),
    manufacturerId: toRequiredNumber(form.manufacturerId, 'Производитель'),
    modelId: toRequiredNumber(form.modelId, 'Модель'),
    specifications: toOptionalText(form.specifications),
    serialNumber: toOptionalText(form.serialNumber),
    inventoryNumber: form.inventoryNumber.trim(),
    countryId: form.countryId,
    manufactureYear: toOptionalNumber(form.manufactureYear) ?? null,
    commissioningDate: toOptionalText(form.commissioningDate),
    issueDate: toOptionalText(form.issueDate),
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

export function toEquipmentFormState(
  equipment: EquipmentCard,
): EquipmentCreateFormState {
  return {
    visibleId: String(equipment.visibleId),
    name: equipment.name,
    manufacturerId: equipment.manufacturerId,
    modelId: equipment.modelId,
    specifications: equipment.specifications ?? '',
    serialNumber: equipment.serialNumber === 'б/н' ? '' : (equipment.serialNumber ?? ''),
    inventoryNumber: equipment.inventoryNumber,
    countryId: equipment.countryId,
    manufactureYear: equipment.manufactureYear
      ? String(equipment.manufactureYear)
      : '',
    commissioningDate: toRuDateInput(equipment.commissioningDate),
    issueDate: toRuDateInput(equipment.issueDate),
    sectionId: equipment.sectionId,
    responsibleEmployeeId: equipment.responsibleEmployeeId,
    status: equipment.status,
    operationText: equipment.operationText ?? '',
    notes: equipment.notes ?? '',
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

function toRuDateInput(value: string | null) {
  if (!value) {
    return '';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return new Intl.DateTimeFormat('ru-RU').format(date);
}

function parseRuDate(value: string) {
  const match = value.trim().match(/^(\d{2})\.(\d{2})\.(\d{4})$/);

  if (!match) {
    return null;
  }

  const [, day, month, year] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));

  if (
    date.getUTCFullYear() !== Number(year) ||
    date.getUTCMonth() !== Number(month) - 1 ||
    date.getUTCDate() !== Number(day)
  ) {
    return null;
  }

  return date;
}

function isRuDateBefore(checkedDateValue: string, minDateValue: string) {
  const checkedDate = parseRuDate(checkedDateValue);
  const minDate = parseRuDate(minDateValue);

  if (!checkedDate || !minDate) {
    return false;
  }

  return checkedDate.getTime() < minDate.getTime();
}

function isCommissioningYearBeforeManufactureYear(
  commissioningDateValue: string,
  manufactureYearValue: string,
) {
  const commissioningDate = parseRuDate(commissioningDateValue);
  const cleanYear = manufactureYearValue.trim();
  const manufactureYear = Number(cleanYear);

  if (!commissioningDate || !/^\d{4}$/.test(cleanYear)) {
    return false;
  }

  return commissioningDate.getUTCFullYear() < manufactureYear;
}
