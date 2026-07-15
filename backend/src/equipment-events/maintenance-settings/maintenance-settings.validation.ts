import {
  EquipmentMaintenanceExecutionType,
  EquipmentMaintenancePeriodicityUnit,
} from '@prisma/client';
import { throwMaintenanceSettingBadRequest } from './maintenance-settings.errors';

const MAX_EVENT_TYPE_NAME_LENGTH = 64;
const MAX_EVENT_TYPE_CODE_LENGTH = 32;

export type CreateMaintenanceSettingDto = {
  checklistTemplateId?: unknown;
  eventTypeId?: unknown;
  executionType?: unknown;
  periodicity?: unknown;
  periodicityUnit?: unknown;
  periodicityValue?: unknown;
};

export type UpdateMaintenanceSettingDto = {
  checklistTemplateId?: unknown;
  executionType?: unknown;
  periodicity?: unknown;
  periodicityUnit?: unknown;
  periodicityValue?: unknown;
};

export type CreateMaintenanceEventTypeDto = MaintenanceSettingBaseDto & {
  code?: unknown;
  name?: unknown;
};

type MaintenanceSettingBaseDto = {
  checklistTemplateId?: unknown;
  executionType?: unknown;
  periodicity?: unknown;
  periodicityUnit?: unknown;
  periodicityValue?: unknown;
};

export type MaintenanceBaseSettingInput = {
  checklistTemplateId: number | null;
  executionType: EquipmentMaintenanceExecutionType;
  periodicity: PeriodicityInput | null;
};

export type MaintenanceSettingInput = MaintenanceBaseSettingInput & {
  eventTypeId: number;
};

export type MaintenanceSettingUpdateInput = {
  checklistTemplateId?: number | null;
  executionType?: EquipmentMaintenanceExecutionType;
  periodicity?: PeriodicityInput | null;
};

export type MaintenanceEventTypeInput = MaintenanceBaseSettingInput & {
  code: string;
  name: string;
};

type PeriodicityInput = {
  unit: EquipmentMaintenancePeriodicityUnit;
  value: number;
};

export function parseCreateMaintenanceSettingDto(
  dto: CreateMaintenanceSettingDto | undefined,
): MaintenanceSettingInput {
  const payload = ensurePayload(dto);
  const setting = parseBaseSettingInput(payload);

  return {
    ...setting,
    eventTypeId: parseRequiredPositiveInteger(
      payload.eventTypeId,
      'EVENT_TYPE_REQUIRED',
      'Укажите тип события.',
    ),
  };
}

export function parseUpdateMaintenanceSettingDto(
  dto: UpdateMaintenanceSettingDto | undefined,
): MaintenanceSettingUpdateInput {
  const payload = ensurePayload(dto);
  const result: MaintenanceSettingUpdateInput = {};

  if ('checklistTemplateId' in payload) {
    result.checklistTemplateId = parseNullablePositiveInteger(
      payload.checklistTemplateId,
      'CHECKLIST_TEMPLATE_ID_INVALID',
      'Некорректный шаблон чек-листа.',
    );
  }

  if ('executionType' in payload) {
    result.executionType = parseRequiredExecutionType(payload.executionType);
  }

  if (hasPeriodicityPayload(payload)) {
    result.periodicity = parseOptionalPeriodicity(payload);
  }

  if (Object.keys(result).length === 0) {
    throwMaintenanceSettingBadRequest(
      'MAINTENANCE_SETTING_UPDATE_EMPTY',
      'Передайте хотя бы одно поле для изменения.',
    );
  }

  return result;
}

export function parseCreateMaintenanceEventTypeDto(
  dto: CreateMaintenanceEventTypeDto | undefined,
): MaintenanceEventTypeInput {
  const payload = ensurePayload(dto);
  const setting = parseBaseSettingInput(payload);

  return {
    ...setting,
    code: parseEventTypeCode(payload.code),
    name: parseEventTypeName(payload.name),
  };
}

function ensurePayload<T extends Record<string, unknown>>(
  dto: T | undefined,
): T {
  if (!dto || typeof dto !== 'object' || Array.isArray(dto)) {
    throwMaintenanceSettingBadRequest(
      'REQUEST_BODY_REQUIRED',
      'Передайте данные настройки.',
    );
  }

  return dto;
}

function parseEventTypeName(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) {
    throwMaintenanceSettingBadRequest(
      'EVENT_TYPE_NAME_REQUIRED',
      'Укажите название типа события.',
    );
  }

  const name = value.trim();

  if (name.length > MAX_EVENT_TYPE_NAME_LENGTH) {
    throwMaintenanceSettingBadRequest(
      'EVENT_TYPE_NAME_TOO_LONG',
      'Название типа события слишком длинное.',
    );
  }

  return name;
}

function parseEventTypeCode(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) {
    throwMaintenanceSettingBadRequest(
      'EVENT_TYPE_CODE_REQUIRED',
      'Укажите код типа события.',
    );
  }

  const code = value.trim().toUpperCase();

  if (code.length > MAX_EVENT_TYPE_CODE_LENGTH) {
    throwMaintenanceSettingBadRequest(
      'EVENT_TYPE_CODE_TOO_LONG',
      'Код типа события слишком длинный.',
    );
  }

  if (!/^[A-Z][A-Z0-9_]*$/.test(code)) {
    throwMaintenanceSettingBadRequest(
      'EVENT_TYPE_CODE_INVALID',
      'Код должен начинаться с латинской буквы и содержать только A-Z, 0-9 и _.',
    );
  }

  return code;
}

function parseBaseSettingInput(
  payload: Record<string, unknown>,
): MaintenanceBaseSettingInput {
  return {
    checklistTemplateId: parseNullablePositiveInteger(
      payload.checklistTemplateId,
      'CHECKLIST_TEMPLATE_ID_INVALID',
      'Некорректный шаблон чек-листа.',
    ),
    executionType: parseRequiredExecutionType(payload.executionType),
    periodicity: parseOptionalPeriodicity(payload),
  };
}

function parseOptionalPeriodicity(payload: Record<string, unknown>) {
  if ('periodicity' in payload && hasFlatPeriodicityPayload(payload)) {
    throwMaintenanceSettingBadRequest(
      'PERIODICITY_FORMAT_CONFLICT',
      'Передайте периодичность либо объектом, либо плоскими полями.',
    );
  }

  if ('periodicity' in payload) {
    if (payload.periodicity === null) {
      return null;
    }

    if (
      !payload.periodicity ||
      typeof payload.periodicity !== 'object' ||
      Array.isArray(payload.periodicity)
    ) {
      throwMaintenanceSettingBadRequest(
        'PERIODICITY_INVALID',
        'Укажите корректную периодичность.',
      );
    }

    const periodicity = payload.periodicity as Record<string, unknown>;

    return parsePeriodicityPair(periodicity.value, periodicity.unit);
  }

  if (!hasFlatPeriodicityPayload(payload)) {
    return null;
  }

  if (payload.periodicityValue === null && payload.periodicityUnit === null) {
    return null;
  }

  return parsePeriodicityPair(payload.periodicityValue, payload.periodicityUnit);
}

function parseRequiredExecutionType(value: unknown) {
  if (
    typeof value !== 'string' ||
    !Object.values(EquipmentMaintenanceExecutionType).includes(
      value as EquipmentMaintenanceExecutionType,
    )
  ) {
    throwMaintenanceSettingBadRequest(
      'EXECUTION_TYPE_INVALID',
      'Укажите корректный способ выполнения.',
    );
  }

  return value as EquipmentMaintenanceExecutionType;
}

function parseRequiredPeriodicityUnit(value: unknown) {
  if (
    typeof value !== 'string' ||
    !Object.values(EquipmentMaintenancePeriodicityUnit).includes(
      value as EquipmentMaintenancePeriodicityUnit,
    )
  ) {
    throwMaintenanceSettingBadRequest(
      'PERIODICITY_UNIT_INVALID',
      'Укажите корректную единицу периодичности.',
    );
  }

  return value as EquipmentMaintenancePeriodicityUnit;
}

function parsePeriodicityPair(value: unknown, unit: unknown) {
  return {
    unit: parseRequiredPeriodicityUnit(unit),
    value: parseRequiredPositiveInteger(
      value,
      'PERIODICITY_VALUE_INVALID',
      'Периодичность должна быть положительным числом.',
    ),
  };
}

function hasPeriodicityPayload(payload: Record<string, unknown>) {
  return 'periodicity' in payload || hasFlatPeriodicityPayload(payload);
}

function hasFlatPeriodicityPayload(payload: Record<string, unknown>) {
  return 'periodicityValue' in payload || 'periodicityUnit' in payload;
}

function parseNullablePositiveInteger(
  value: unknown,
  code: string,
  message: string,
) {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  return parseRequiredPositiveInteger(value, code, message);
}

function parseRequiredPositiveInteger(
  value: unknown,
  code: string,
  message: string,
) {
  if (typeof value === 'number' && Number.isInteger(value) && value > 0) {
    return value;
  }

  if (typeof value === 'string' && /^[1-9]\d*$/.test(value)) {
    const parsed = Number(value);

    if (Number.isSafeInteger(parsed)) {
      return parsed;
    }
  }

  throwMaintenanceSettingBadRequest(code, message);
}
