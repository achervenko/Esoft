import { EquipmentEventStatus } from '@prisma/client';
import { throwEquipmentEventBadRequest } from './equipment-events.errors';

export type CreateManualEquipmentEventDto = {
  equipmentVisibleId?: unknown;
  eventTypeId?: unknown;
  factDate?: unknown;
  responsibleEmployeeIds?: unknown;
};

export type CompleteEquipmentEventDto = {
  factDate?: unknown;
};

export type UpdateDraftEquipmentEventDto = {
  equipmentVisibleId?: unknown;
  eventTypeId?: unknown;
  factDate?: unknown;
  responsibleEmployeeIds?: unknown;
  version?: unknown;
};

export type EquipmentEventsQueryDto = {
  dateFrom?: unknown;
  dateTo?: unknown;
  equipmentVisibleId?: unknown;
  eventTypeId?: unknown;
  limit?: unknown;
  offset?: unknown;
  responsibleEmployeeId?: unknown;
  status?: unknown;
};

export type CreateManualEquipmentEventData = {
  equipmentVisibleId: number;
  eventTypeId: number;
  factDate: Date;
  responsibleEmployeeIds: number[];
};

export type CompleteEquipmentEventData = {
  factDate?: Date;
};

export type UpdateDraftEquipmentEventData = {
  equipmentVisibleId?: number;
  eventTypeId?: number;
  factDate?: Date;
  responsibleEmployeeIds?: number[];
  version: number;
};

export type EquipmentEventsQuery = {
  dateFrom?: Date;
  dateTo?: Date;
  equipmentVisibleId?: number;
  eventTypeId?: number;
  limit: number;
  offset: number;
  responsibleEmployeeId?: number;
  status?: EquipmentEventStatus;
};

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;
const BUSINESS_TIME_ZONE = 'Europe/Moscow';

export function parseCreateManualEventDto(
  dto: CreateManualEquipmentEventDto | undefined,
): CreateManualEquipmentEventData {
  const body = dto ?? {};

  return {
    equipmentVisibleId: parsePositiveInteger(
      body.equipmentVisibleId,
      'EQUIPMENT_REQUIRED',
      'Укажите оборудование.',
    ),
    eventTypeId: parsePositiveInteger(
      body.eventTypeId,
      'EVENT_TYPE_REQUIRED',
      'Укажите тип события.',
    ),
    factDate: parseRequiredFactDate(
      body.factDate,
      'FACT_DATE_REQUIRED',
      'Укажите фактическую дату события.',
    ),
    responsibleEmployeeIds: parseResponsibleEmployeeIds(
      body.responsibleEmployeeIds,
    ),
  };
}

export function parseCompleteEventDto(
  dto: CompleteEquipmentEventDto | undefined,
): CompleteEquipmentEventData {
  if (
    !dto ||
    dto.factDate === undefined ||
    dto.factDate === null ||
    dto.factDate === ''
  ) {
    return {};
  }

  return {
    factDate: parseRequiredFactDate(
      dto.factDate,
      'FACT_DATE_INVALID',
      'Некорректная фактическая дата.',
    ),
  };
}

export function parseUpdateDraftEventDto(
  dto: UpdateDraftEquipmentEventDto | undefined,
): UpdateDraftEquipmentEventData {
  const body = dto ?? {};

  const data: UpdateDraftEquipmentEventData = {
    equipmentVisibleId: parseOptionalPositiveInteger(
      body.equipmentVisibleId,
      'EQUIPMENT_INVALID',
      'Некорректный ID оборудования.',
    ),
    eventTypeId: parseOptionalPositiveInteger(
      body.eventTypeId,
      'EVENT_TYPE_INVALID',
      'Некорректный тип события.',
    ),
    factDate:
      body.factDate === undefined ||
      body.factDate === null ||
      body.factDate === ''
        ? undefined
        : parseRequiredFactDate(
            body.factDate,
            'FACT_DATE_INVALID',
            'Некорректная фактическая дата.',
          ),
    responsibleEmployeeIds:
      body.responsibleEmployeeIds === undefined
        ? undefined
        : parseResponsibleEmployeeIds(body.responsibleEmployeeIds),
    version: parsePositiveInteger(
      body.version,
      'VERSION_REQUIRED',
      'Укажите версию события.',
    ),
  };

  if (
    data.equipmentVisibleId === undefined &&
    data.eventTypeId === undefined &&
    data.factDate === undefined &&
    data.responsibleEmployeeIds === undefined
  ) {
    throwEquipmentEventBadRequest(
      'UPDATE_EMPTY',
      'Укажите данные для изменения события.',
    );
  }

  return data;
}

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
    eventTypeId: parseOptionalPositiveInteger(
      query.eventTypeId,
      'EVENT_TYPE_INVALID',
      'Некорректный тип события.',
    ),
    limit: parseLimit(query.limit),
    offset: parseOffset(query.offset),
    responsibleEmployeeId: parseOptionalPositiveInteger(
      query.responsibleEmployeeId,
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

function parseResponsibleEmployeeIds(value: unknown) {
  if (!Array.isArray(value)) {
    throwEquipmentEventBadRequest(
      'RESPONSIBLES_REQUIRED',
      'Укажите ответственных за событие.',
    );
  }

  const ids = [
    ...new Set(
      value.map((item) =>
        parsePositiveInteger(
          item,
          'RESPONSIBLE_INVALID',
          'Некорректный ответственный.',
        ),
      ),
    ),
  ];

  if (ids.length === 0) {
    throwEquipmentEventBadRequest(
      'RESPONSIBLES_REQUIRED',
      'Укажите хотя бы одного ответственного.',
    );
  }

  return ids;
}

function parseOptionalStatus(value: unknown) {
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

function parseLimit(value: unknown) {
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

function parseOffset(value: unknown) {
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

function parseOptionalPositiveInteger(
  value: unknown,
  code: string,
  message: string,
) {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  return parsePositiveInteger(value, code, message);
}

function parsePositiveInteger(value: unknown, code: string, message: string) {
  const numberValue = parseIntegerValue(value);

  if (numberValue === undefined || numberValue <= 0) {
    throwEquipmentEventBadRequest(code, message);
  }

  return numberValue;
}

function parseOptionalDate(value: unknown, code: string) {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  return parseRequiredDate(value, code, 'Дата должна быть в формате ГГГГ-ММ-ДД.');
}

function parseRequiredDate(value: unknown, code: string, message: string) {
  const dateValue = parseDateString(value, code, message);

  return new Date(`${dateValue}T00:00:00.000Z`);
}

function parseRequiredFactDate(value: unknown, code: string, message: string) {
  const dateValue = parseDateString(value, code, message);

  if (dateValue > getTodayDateString()) {
    throwEquipmentEventBadRequest(
      'FACT_DATE_IN_FUTURE',
      'Фактическая дата события не может быть позже текущей даты.',
    );
  }

  return new Date(`${dateValue}T00:00:00.000Z`);
}

function parseDateString(value: unknown, code: string, message: string) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throwEquipmentEventBadRequest(code, message);
  }

  const date = new Date(`${value}T00:00:00.000Z`);

  if (
    Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value
  ) {
    throwEquipmentEventBadRequest(code, message);
  }

  return value;
}

function parseIntegerValue(value: unknown) {
  if (typeof value === 'number') {
    return Number.isInteger(value) && Number.isFinite(value)
      ? value
      : undefined;
  }

  if (typeof value === 'string' && /^(0|[1-9]\d*)$/.test(value)) {
    return Number(value);
  }

  return undefined;
}

function getTodayDateString() {
  const parts = new Intl.DateTimeFormat('en-US', {
    day: '2-digit',
    month: '2-digit',
    timeZone: BUSINESS_TIME_ZONE,
    year: 'numeric',
  }).formatToParts(new Date());

  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value]),
  );

  return `${values.year}-${values.month}-${values.day}`;
}
