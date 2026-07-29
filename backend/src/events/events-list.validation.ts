import { EventExtensionCode, EventSource, EventStatus } from '@prisma/client';
import type { Prisma } from '@prisma/client';
import { throwEventBadRequest } from './events.errors';
import {
  parseRequiredDate,
  parseRequiredNonEmptyString,
} from './events.validation.parsers';
import type { EventsListQueryDto } from './events.validation.types';

const EVENTS_LIST_LIMIT_DEFAULT = 50;
const EVENTS_LIST_LIMIT_MAX = 100;

export type ParsedEventsListQuery = {
  limit: number;
  offset: number;
  where: Prisma.EventWhereInput;
};

export function parseEventsListQueryDto(
  dto: EventsListQueryDto | undefined,
): ParsedEventsListQuery {
  const body = dto ?? {};
  const where: Prisma.EventWhereInput = {};
  const status = parseOptionalEnumValue(
    body.status,
    EventStatus,
    'EVENT_STATUS_INVALID',
    'Некорректный статус события.',
  );
  const source = parseOptionalEnumValue(
    body.source,
    EventSource,
    'EVENT_SOURCE_INVALID',
    'Некорректный источник события.',
  );
  const extensionCode = parseOptionalExtensionCode(body.extensionCode);
  const equipmentVisibleId = parseOptionalQueryPositiveInteger(
    body.equipmentVisibleId,
    'EQUIPMENT_INVALID',
    'Некорректный ID оборудования.',
  );
  const maintenanceTypeId = parseOptionalQueryPositiveInteger(
    body.maintenanceTypeId,
    'MAINTENANCE_TYPE_INVALID',
    'Некорректный вид обслуживания.',
  );
  const dateFrom = parseOptionalQueryDate(
    body.dateFrom,
    'DATE_FROM_INVALID',
    'Некорректная дата начала периода.',
  );
  const dateTo = parseOptionalQueryDate(
    body.dateTo,
    'DATE_TO_INVALID',
    'Некорректная дата окончания периода.',
  );

  if (dateFrom !== undefined && dateTo !== undefined && dateFrom > dateTo) {
    throwEventBadRequest(
      'DATE_RANGE_INVALID',
      'Дата начала периода не может быть позже даты окончания.',
    );
  }

  const responsibleUserId = parseOptionalQueryString(
    body.responsibleUserId,
    'RESPONSIBLE_USER_INVALID',
    'Некорректный ответственный.',
  );

  if (status !== undefined) {
    where.status = status;
  }

  if (source !== undefined) {
    where.source = source;
  }

  if (extensionCode !== undefined) {
    where.extensionCode = extensionCode;
  }

  if (equipmentVisibleId !== undefined || maintenanceTypeId !== undefined) {
    if (extensionCode !== EventExtensionCode.EQUIPMENT) {
      throwEventBadRequest(
        'EVENT_EXTENSION_CODE_REQUIRED',
        'Фильтры оборудования доступны только для событий оборудования.',
      );
    }

    where.extensionCode = EventExtensionCode.EQUIPMENT;
    where.equipmentExtension = {
      is: {
        ...(equipmentVisibleId !== undefined
          ? { equipment: { visibleId: equipmentVisibleId } }
          : {}),
        ...(maintenanceTypeId !== undefined
          ? { eventTypeId: maintenanceTypeId }
          : {}),
      },
    };
  }

  if (dateFrom !== undefined || dateTo !== undefined) {
    where.plannedDate = {
      ...(dateFrom !== undefined ? { gte: dateFrom } : {}),
      ...(dateTo !== undefined ? { lt: addUtcDays(dateTo, 1) } : {}),
    };
  }

  if (responsibleUserId !== undefined) {
    where.responsibles = {
      some: {
        userId: responsibleUserId,
      },
    };
  }

  return {
    limit: parseOptionalLimit(body.limit),
    offset: parseOptionalOffset(body.offset),
    where,
  };
}

function parseOptionalEnumValue<TValue extends string>(
  value: unknown,
  enumObject: Record<string, TValue>,
  code: string,
  message: string,
): TValue | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  if (typeof value !== 'string') {
    throwEventBadRequest(code, message);
  }

  const enumValues = new Set(Object.values(enumObject));

  if (!enumValues.has(value as TValue)) {
    throwEventBadRequest(code, message);
  }

  return value as TValue;
}

function parseOptionalExtensionCode(
  value: unknown,
): EventExtensionCode | null | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (value === '' || value === 'NONE') {
    return null;
  }

  return parseOptionalEnumValue(
    value,
    EventExtensionCode,
    'EVENT_EXTENSION_CODE_INVALID',
    'Некорректный тип расширения события.',
  );
}

function parseOptionalQueryDate(
  value: unknown,
  code: string,
  message: string,
): Date | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  return parseRequiredDate(value, code, message);
}

function addUtcDays(value: Date, days: number): Date {
  const result = new Date(value);

  result.setUTCDate(result.getUTCDate() + days);

  return result;
}

function parseOptionalQueryString(
  value: unknown,
  code: string,
  message: string,
): string | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  return parseRequiredNonEmptyString(value, code, message);
}

function parseOptionalLimit(value: unknown): number {
  if (value === undefined || value === null || value === '') {
    return EVENTS_LIST_LIMIT_DEFAULT;
  }

  const parsedValue = parseQueryInteger(
    value,
    'LIMIT_INVALID',
    'Некорректный лимит списка событий.',
  );

  if (parsedValue <= 0 || parsedValue > EVENTS_LIST_LIMIT_MAX) {
    throwEventBadRequest('LIMIT_INVALID', 'Некорректный лимит списка событий.');
  }

  return parsedValue;
}

function parseOptionalOffset(value: unknown): number {
  if (value === undefined || value === null || value === '') {
    return 0;
  }

  const parsedValue = parseQueryInteger(
    value,
    'OFFSET_INVALID',
    'Некорректное смещение списка событий.',
  );

  if (parsedValue < 0) {
    throwEventBadRequest(
      'OFFSET_INVALID',
      'Некорректное смещение списка событий.',
    );
  }

  return parsedValue;
}

function parseOptionalQueryPositiveInteger(
  value: unknown,
  code: string,
  message: string,
): number | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  const parsedValue = parseQueryInteger(value, code, message);

  if (parsedValue <= 0) {
    throwEventBadRequest(code, message);
  }

  return parsedValue;
}

function parseQueryInteger(
  value: unknown,
  code: string,
  message: string,
): number {
  const valueAsString =
    typeof value === 'number' || typeof value === 'string'
      ? String(value)
      : null;

  if (!valueAsString || !/^(0|[1-9]\d*)$/.test(valueAsString)) {
    throwEventBadRequest(code, message);
  }

  const parsedValue = Number(valueAsString);

  if (!Number.isSafeInteger(parsedValue)) {
    throwEventBadRequest(code, message);
  }

  return parsedValue;
}
