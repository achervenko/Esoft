import { throwMaintenanceTypeBadRequest } from './maintenance-types.errors';

const MAX_MAINTENANCE_TYPE_NAME_LENGTH = 64;
const MAX_MAINTENANCE_TYPE_CODE_LENGTH = 32;

export type CreateMaintenanceTypeDto = {
  code?: unknown;
  name?: unknown;
};

export type UpdateMaintenanceTypeDto = {
  name?: unknown;
};

export type MaintenanceTypesQueryDto = {
  includeInactive?: unknown;
};

export type CreateMaintenanceTypeInput = {
  code: string;
  name: string;
};

export type UpdateMaintenanceTypeInput = {
  name: string;
};

export function parseMaintenanceTypesQuery(query: MaintenanceTypesQueryDto) {
  return {
    includeInactive: parseOptionalBoolean(query.includeInactive),
  };
}

export function parseCreateMaintenanceTypeDto(
  dto: CreateMaintenanceTypeDto | undefined,
): CreateMaintenanceTypeInput {
  const payload = ensurePayload(dto);

  return {
    code: parseMaintenanceTypeCode(payload.code),
    name: parseMaintenanceTypeName(payload.name),
  };
}

export function parseUpdateMaintenanceTypeDto(
  dto: UpdateMaintenanceTypeDto | undefined,
): UpdateMaintenanceTypeInput {
  const payload = ensurePayload(dto);

  return {
    name: parseMaintenanceTypeName(payload.name),
  };
}

function ensurePayload<T extends Record<string, unknown>>(
  dto: T | undefined,
): T {
  if (!dto || typeof dto !== 'object' || Array.isArray(dto)) {
    throwMaintenanceTypeBadRequest(
      'REQUEST_BODY_REQUIRED',
      'Передайте данные вида обслуживания.',
    );
  }

  return dto;
}

function parseMaintenanceTypeName(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) {
    throwMaintenanceTypeBadRequest(
      'MAINTENANCE_TYPE_NAME_REQUIRED',
      'Укажите название вида обслуживания.',
    );
  }

  const name = value.trim();

  if (name.length > MAX_MAINTENANCE_TYPE_NAME_LENGTH) {
    throwMaintenanceTypeBadRequest(
      'MAINTENANCE_TYPE_NAME_TOO_LONG',
      'Название вида обслуживания слишком длинное.',
    );
  }

  return name;
}

function parseMaintenanceTypeCode(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) {
    throwMaintenanceTypeBadRequest(
      'MAINTENANCE_TYPE_CODE_REQUIRED',
      'Укажите код вида обслуживания.',
    );
  }

  const code = value.trim().toUpperCase();

  if (code.length > MAX_MAINTENANCE_TYPE_CODE_LENGTH) {
    throwMaintenanceTypeBadRequest(
      'MAINTENANCE_TYPE_CODE_TOO_LONG',
      'Код вида обслуживания слишком длинный.',
    );
  }

  if (!/^[A-Z][A-Z0-9_]*$/.test(code)) {
    throwMaintenanceTypeBadRequest(
      'MAINTENANCE_TYPE_CODE_INVALID',
      'Код должен начинаться с латинской буквы и содержать только A-Z, 0-9 и _.',
    );
  }

  return code;
}

function parseOptionalBoolean(value: unknown) {
  if (value === undefined || value === null || value === '') {
    return false;
  }

  if (value === true || value === 'true') {
    return true;
  }

  if (value === false || value === 'false') {
    return false;
  }

  throwMaintenanceTypeBadRequest(
    'INCLUDE_INACTIVE_INVALID',
    'Некорректный признак includeInactive.',
  );
}
