import { EventExtensionCode, EventSource, EventStatus } from '@prisma/client';
import type { Prisma } from '@prisma/client';
import type { EventExtensionRegistry } from './event-extensions/event-extension.registry';
import { throwEventBadRequest } from './events.errors';
import {
  parseRequiredDate,
  parseRequiredNonEmptyString,
} from './events.validation.parsers';
import type { EventsListQueryDto } from './events.validation.types';

const EVENTS_LIST_LIMIT_DEFAULT = 50;
const EVENTS_LIST_LIMIT_MAX = 100;
const EVENT_EXTENSION_CODE_VALUES = new Set<EventExtensionCode>(
  Object.values(EventExtensionCode),
);
const EVENT_SOURCE_VALUES = new Set<EventSource>(Object.values(EventSource));
const EVENT_STATUS_VALUES = new Set<EventStatus>(Object.values(EventStatus));

export type ParsedEventsListQuery = {
  limit: number;
  offset: number;
  where: Prisma.EventWhereInput;
};

export function parseEventsListQueryDto(
  dto: EventsListQueryDto | undefined,
  extensionRegistry: EventExtensionRegistry,
): ParsedEventsListQuery {
  const body = dto ?? {};
  const where: Prisma.EventWhereInput = {};
  const status = parseOptionalEnumValue(
    body.status,
    EVENT_STATUS_VALUES,
    'EVENT_STATUS_INVALID',
    'Некорректный статус события.',
  );
  const source = parseOptionalEnumValue(
    body.source,
    EVENT_SOURCE_VALUES,
    'EVENT_SOURCE_INVALID',
    'Некорректный источник события.',
  );
  const extensionCode = parseOptionalExtensionCode(body.extensionCode);
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

  Object.assign(
    where,
    extensionRegistry.buildListWhere({
      extensionCode,
      query: body,
    }),
  );

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
  enumValues: ReadonlySet<TValue>,
  code: string,
  message: string,
): TValue | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  if (typeof value !== 'string') {
    throwEventBadRequest(code, message);
  }

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
    EVENT_EXTENSION_CODE_VALUES,
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
