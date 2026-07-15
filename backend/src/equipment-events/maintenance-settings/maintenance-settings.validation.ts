import { EquipmentMaintenanceExecutionType } from '@prisma/client';
import { throwMaintenanceSettingBadRequest } from './maintenance-settings.errors';

export type CreateMaintenanceSettingDto = {
  checklistTemplateId?: unknown;
  executionType?: unknown;
  maintenanceTypeId?: unknown;
  periodicity?: unknown;
};

export type UpdateMaintenanceSettingDto = {
  checklistTemplateId?: unknown;
  executionType?: unknown;
  periodicity?: unknown;
};

type MaintenanceSettingBaseDto = {
  checklistTemplateId?: unknown;
  executionType?: unknown;
  periodicity?: unknown;
};

export type MaintenanceBaseSettingInput = {
  checklistTemplateId: number | null;
  executionType: EquipmentMaintenanceExecutionType;
  periodicity: PeriodicityInput | null;
};

export type MaintenanceSettingInput = MaintenanceBaseSettingInput & {
  maintenanceTypeId: number;
};

export type MaintenanceSettingUpdateInput = {
  checklistTemplateId?: number | null;
  executionType?: EquipmentMaintenanceExecutionType;
  periodicity?: PeriodicityInput | null;
};

export type PeriodicityInput = {
  years: number;
  months: number;
  weeks: number;
  days: number;
};

export function parseCreateMaintenanceSettingDto(
  dto: CreateMaintenanceSettingDto | undefined,
): MaintenanceSettingInput {
  const payload = ensurePayload(dto);
  const setting = parseBaseSettingInput(payload);

  return {
    ...setting,
    maintenanceTypeId: parseRequiredPositiveInteger(
      payload.maintenanceTypeId,
      'MAINTENANCE_TYPE_REQUIRED',
      'Укажите вид обслуживания.',
    ),
  };
}

export function parseUpdateMaintenanceSettingDto(
  dto: UpdateMaintenanceSettingDto | undefined,
): MaintenanceSettingUpdateInput {
  const payload = ensurePayload(dto);
  const result: MaintenanceSettingUpdateInput = {};

  if ('maintenanceTypeId' in payload) {
    throwMaintenanceSettingBadRequest(
      'MAINTENANCE_TYPE_INVALID',
      'Вид обслуживания нельзя изменить в настройке.',
    );
  }

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
  assertNoFlatPeriodicityFields(payload);

  if (!('periodicity' in payload)) {
    return null;
  }

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

  return parsePeriodicity(payload.periodicity as Record<string, unknown>);
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

function parsePeriodicity(value: Record<string, unknown>): PeriodicityInput {
  assertAllowedPeriodicityFields(value);

  const periodicity = {
    years: parseOptionalNonNegativeInteger(value.years),
    months: parseOptionalNonNegativeInteger(value.months),
    weeks: parseOptionalNonNegativeInteger(value.weeks),
    days: parseOptionalNonNegativeInteger(value.days),
  };

  if (
    periodicity.days === 0 &&
    periodicity.months === 0 &&
    periodicity.weeks === 0 &&
    periodicity.years === 0
  ) {
    throwMaintenanceSettingBadRequest(
      'PERIODICITY_VALUE_INVALID',
      'Укажите периодичность больше нуля.',
    );
  }

  return periodicity;
}

function assertAllowedPeriodicityFields(value: Record<string, unknown>) {
  const allowedFields = new Set(['days', 'months', 'weeks', 'years']);
  const unknownField = Object.keys(value).find(
    (field) => !allowedFields.has(field),
  );

  if (unknownField) {
    throwMaintenanceSettingBadRequest(
      'PERIODICITY_INVALID',
      'Периодичность содержит неизвестные поля.',
    );
  }
}

function parseOptionalNonNegativeInteger(value: unknown) {
  if (value === undefined || value === null || value === '') {
    return 0;
  }

  return parseRequiredNonNegativeInteger(
    value,
    'PERIODICITY_VALUE_INVALID',
    'Периодичность должна состоять из неотрицательных целых чисел.',
  );
}

function parseRequiredNonNegativeInteger(
  value: unknown,
  code: string,
  message: string,
) {
  if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0) {
    return value;
  }

  if (typeof value === 'string' && /^(0|[1-9]\d*)$/.test(value)) {
    const parsed = Number(value);

    if (Number.isSafeInteger(parsed)) {
      return parsed;
    }
  }

  throwMaintenanceSettingBadRequest(code, message);
}

function hasPeriodicityPayload(payload: Record<string, unknown>) {
  if ('periodicityValue' in payload || 'periodicityUnit' in payload) {
    return true;
  }

  return 'periodicity' in payload;
}

function assertNoFlatPeriodicityFields(payload: Record<string, unknown>) {
  if ('periodicityValue' in payload || 'periodicityUnit' in payload) {
    throwMaintenanceSettingBadRequest(
      'PERIODICITY_FORMAT_CONFLICT',
      'Передайте периодичность объектом periodicity.',
    );
  }
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
  if (typeof value === 'number' && Number.isSafeInteger(value) && value > 0) {
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
