import {
  isBlank,
  isInvalidRuDate,
  isLongerThan,
  isNotPositiveInteger,
  isYearOutsideRange,
  validateForm,
  type ValidationRule,
} from "../../../shared/lib/form-validation";
import type {
  EquipmentCreateFieldErrors,
  EquipmentCreateFormState,
  EquipmentCreateValidationResult,
} from "./equipment-create-form.types";

const maxTextLength = 4000;

const equipmentCreateValidationRules: ValidationRule<EquipmentCreateFormState>[] =
  [
    {
      field: "visibleId",
      message: "ID должен быть положительным целым числом.",
      trigger: (form) => isNotPositiveInteger(form.visibleId),
    },
    {
      field: "name",
      message: "Укажите название оборудования.",
      trigger: (form) => isBlank(form.name),
    },
    {
      field: "name",
      message: "Название оборудования: максимум 128 символов.",
      trigger: (form) => isLongerThan(form.name, 128),
    },
    {
      field: "inventoryNumber",
      message: "Укажите инвентарный номер.",
      trigger: (form) => isBlank(form.inventoryNumber),
    },
    {
      field: "inventoryNumber",
      message: "Инвентарный номер: максимум 64 символа.",
      trigger: (form) => isLongerThan(form.inventoryNumber, 64),
    },
    {
      field: "serialNumber",
      message: "Заводской номер: максимум 128 символов.",
      trigger: (form) => isLongerThan(form.serialNumber, 128),
    },
    {
      field: "manufacturerId",
      message: "Выберите производителя из списка.",
      trigger: (form) => !form.manufacturerId,
    },
    {
      field: "modelId",
      message: "Выберите модель из списка.",
      trigger: (form) => !form.modelId,
    },
    {
      field: "manufactureYear",
      message: "Год выпуска должен быть от 1900 до 2100.",
      trigger: (form) => isYearOutsideRange(form.manufactureYear, 1900, 2100),
    },
    {
      field: "commissioningDate",
      message: "Введите реальную дату в формате ДД.ММ.ГГГГ.",
      trigger: (form) => isInvalidRuDate(form.commissioningDate),
    },
    {
      field: "issueDate",
      message: "Укажите дату выдачи.",
      trigger: (form) => isBlank(form.issueDate),
    },
    {
      field: "issueDate",
      message: "Введите реальную дату выдачи в формате ДД.ММ.ГГГГ.",
      trigger: (form) => isInvalidRuDate(form.issueDate),
    },
    {
      field: "issueDate",
      message: "Дата выдачи не может быть раньше года выпуска оборудования.",
      trigger: (form) =>
        isIssueDateBeforeManufactureYear(
          form.issueDate,
          form.commissioningDate,
          form.manufactureYear,
        ),
    },
    {
      field: "specifications",
      message: `Технические характеристики: максимум ${maxTextLength} символов.`,
      trigger: (form) => isLongerThan(form.specifications, maxTextLength),
    },
    {
      field: "operationText",
      message: `Технологическая операция: максимум ${maxTextLength} символов.`,
      trigger: (form) => isLongerThan(form.operationText, maxTextLength),
    },
    {
      field: "notes",
      message: `Примечание: максимум ${maxTextLength} символов.`,
      trigger: (form) => isLongerThan(form.notes, maxTextLength),
    },
    {
      field: "issueDate",
      message: "Дата выдачи не может быть раньше даты ввода в эксплуатацию.",
      trigger: (form) => isRuDateBefore(form.issueDate, form.commissioningDate),
    },
    {
      field: "commissioningDate",
      message: "Год ввода в эксплуатацию не может быть меньше года выпуска.",
      trigger: (form) =>
        isCommissioningYearBeforeManufactureYear(
          form.commissioningDate,
          form.manufactureYear,
        ),
    },
    {
      field: "sectionId",
      message: "Выберите местонахождение из списка.",
      trigger: (form) => !form.sectionId,
    },
    {
      field: "responsibleEmployeeId",
      message: "Выберите ответственного из списка.",
      trigger: (form) => !form.responsibleEmployeeId,
    },
    {
      field: "status",
      message: "Выберите статус.",
      trigger: (form) => isBlank(form.status),
    },
  ];

export function validateEquipmentCreateForm(
  form: EquipmentCreateFormState,
): EquipmentCreateValidationResult {
  return validateForm(form, equipmentCreateValidationRules);
}

export function getEquipmentFieldErrorsFromMessage(message: string) {
  const lowerMessage = message.toLowerCase();
  const fieldErrors: EquipmentCreateFieldErrors = {};

  if (
    lowerMessage.includes("visibleid") ||
    lowerMessage.includes("visible id") ||
    lowerMessage.includes("идентификатор оборудования")
  ) {
    fieldErrors.visibleId = message;
  }

  if (lowerMessage.includes("дата выдачи")) {
    fieldErrors.issueDate = message;
  }

  if (lowerMessage.includes("год ввода")) {
    fieldErrors.commissioningDate = message;
  }

  if (lowerMessage.includes("производител")) {
    fieldErrors.manufacturerId = message;
  }

  if (lowerMessage.includes("модел")) {
    fieldErrors.modelId = message;
  }

  return fieldErrors;
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

function isIssueDateBeforeManufactureYear(
  issueDateValue: string,
  commissioningDateValue: string,
  manufactureYearValue: string,
) {
  if (commissioningDateValue.trim()) {
    return false;
  }

  const issueDate = parseRuDate(issueDateValue);
  const cleanYear = manufactureYearValue.trim();
  const manufactureYear = Number(cleanYear);

  if (!issueDate || !/^\d{4}$/.test(cleanYear)) {
    return false;
  }

  return issueDate.getUTCFullYear() < manufactureYear;
}
