import { EquipmentEventStatus } from '@prisma/client';
import { throwEquipmentEventBadRequest } from './equipment-events.errors';
import {
  parseIntegerValue,
  parseOptionalDate,
  parseOptionalNonEmptyString,
  parseOptionalPositiveInteger,
} from './equipment-events-validation.utils';
import {
  type EquipmentEventsQuery,
  type EquipmentEventsQueryDto,
} from './equipment-events.validation.types';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

export function parseEquipmentEventsQuery(
  query: EquipmentEventsQueryDto,
): EquipmentEventsQuery {
  const parsedQuery = {
    dateFrom: parseOptionalDate(query.dateFrom, 'DATE_FROM_INVALID'),
    dateTo: parseOptionalDate(query.dateTo, 'DATE_TO_INVALID'),
    equipmentVisibleId: parseOptionalPositiveInteger(
      query.equipmentVisibleId,
      'EQUIPMENT_INVALID',
      'Некорректный ID оборудования.',
    ),
    maintenanceTypeId: parseOptionalPositiveInteger(
      query.maintenanceTypeId,
      'MAINTENANCE_TYPE_INVALID',
      'Некорректный вид обслуживания.',
    ),
    limit: parseLimit(query.limit),
    offset: parseOffset(query.offset),
    responsibleUserId: parseOptionalNonEmptyString(
      query.responsibleUserId,
      'RESPONSIBLE_INVALID',
      'Некорректный ответственный.',
    ),
    status: parseOptionalStatus(query.status),
  };

  if (
    parsedQuery.dateFrom &&
    parsedQuery.dateTo &&
    parsedQuery.dateFrom > parsedQuery.dateTo
  ) {
    throwEquipmentEventBadRequest(
      'DATE_RANGE_INVALID',
      'Дата начала не может быть позже даты окончания.',
    );
  }

  return parsedQuery;
}

export function parseLimit(value: unknown) {
  if (value === undefined || value === null || value === '') {
    return DEFAULT_LIMIT;
  }

  const limit = parseIntegerValue(value);

  if (limit === undefined || limit <= 0) {
    throwEquipmentEventBadRequest(
      'LIMIT_INVALID',
      'Некорректный лимит списка.',
    );
  }

  return Math.min(limit, MAX_LIMIT);
}

export function parseOffset(value: unknown) {
  if (value === undefined || value === null || value === '') {
    return 0;
  }

  const offset = parseIntegerValue(value);

  if (offset === undefined || offset < 0) {
    throwEquipmentEventBadRequest(
      'OFFSET_INVALID',
      'Некорректное смещение списка.',
    );
  }

  return offset;
}

export function parseOptionalStatus(value: unknown) {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  if (
    typeof value !== 'string' ||
    !(Object.values(EquipmentEventStatus) as string[]).includes(value)
  ) {
    throwEquipmentEventBadRequest(
      'STATUS_INVALID',
      'Некорректный статус события.',
    );
  }

  return value as EquipmentEventStatus;
}
