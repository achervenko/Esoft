import { throwMaintenanceSettingBadRequest } from './maintenance-settings.errors';
import type { PeriodicityInput } from './maintenance-settings.types';

export function hasPeriodicityPayload(payload: Record<string, unknown>) {
  if ('periodicityValue' in payload || 'periodicityUnit' in payload) {
    return true;
  }

  return 'periodicity' in payload;
}

export function parseOptionalPeriodicity(payload: Record<string, unknown>) {
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

function assertNoFlatPeriodicityFields(payload: Record<string, unknown>) {
  if ('periodicityValue' in payload || 'periodicityUnit' in payload) {
    throwMaintenanceSettingBadRequest(
      'PERIODICITY_FORMAT_CONFLICT',
      'Передайте периодичность объектом periodicity.',
    );
  }
}
