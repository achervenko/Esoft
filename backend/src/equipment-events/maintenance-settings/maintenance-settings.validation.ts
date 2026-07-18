import { EquipmentMaintenanceExecutionType } from '@prisma/client';
import {
  hasDefaultChecklistTemplatePayload,
  parseNullableChecklistTemplateId,
  parseRequiredPositiveInteger,
} from './maintenance-setting-checklists.validation';
import {
  hasPeriodicityPayload,
  parseOptionalPeriodicity,
} from './maintenance-setting-periodicity.validation';
import type {
  CreateMaintenanceSettingDto,
  MaintenanceSettingBaseDto,
  UpdateMaintenanceSettingDto,
} from './maintenance-settings.dto';
import { throwMaintenanceSettingBadRequest } from './maintenance-settings.errors';
import type {
  MaintenanceBaseSettingInput,
  MaintenanceSettingInput,
  MaintenanceSettingUpdateInput,
} from './maintenance-settings.types';

export type {
  CreateMaintenanceSettingDto,
  UpdateMaintenanceSettingDto,
} from './maintenance-settings.dto';
export type {
  MaintenanceBaseSettingInput,
  MaintenanceSettingInput,
  MaintenanceSettingUpdateInput,
  PeriodicityInput,
} from './maintenance-settings.types';

export function parseCreateMaintenanceSettingDto(
  dto: CreateMaintenanceSettingDto | undefined,
): MaintenanceSettingInput {
  const payload = ensurePayload(dto);

  return {
    ...parseBaseSettingInput(payload),
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

  assertMaintenanceTypeNotMutable(payload);

  if (hasDefaultChecklistTemplatePayload(payload)) {
    result.defaultChecklistTemplateId =
      parseNullableChecklistTemplateId(payload);
  }

  if ('executionType' in payload) {
    result.executionType = parseRequiredExecutionType(payload.executionType);
  }

  if (hasPeriodicityPayload(payload)) {
    result.periodicity = parseOptionalPeriodicity(payload);
  }

  assertUpdateNotEmpty(result);

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
  payload: MaintenanceSettingBaseDto,
): MaintenanceBaseSettingInput {
  return {
    defaultChecklistTemplateId: hasDefaultChecklistTemplatePayload(payload)
      ? parseNullableChecklistTemplateId(payload)
      : null,
    executionType: parseRequiredExecutionType(payload.executionType),
    periodicity: parseOptionalPeriodicity(payload),
  };
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

function assertMaintenanceTypeNotMutable(payload: Record<string, unknown>) {
  if ('maintenanceTypeId' in payload) {
    throwMaintenanceSettingBadRequest(
      'MAINTENANCE_TYPE_INVALID',
      'Вид обслуживания нельзя изменить в настройке.',
    );
  }
}

function assertUpdateNotEmpty(input: MaintenanceSettingUpdateInput) {
  if (Object.keys(input).length === 0) {
    throwMaintenanceSettingBadRequest(
      'MAINTENANCE_SETTING_UPDATE_EMPTY',
      'Передайте хотя бы одно поле для изменения.',
    );
  }
}
