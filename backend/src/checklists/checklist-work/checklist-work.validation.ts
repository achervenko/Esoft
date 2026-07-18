import { ChecklistStatus } from '@prisma/client';
import { throwChecklistBadRequest } from '../checklist-common/checklists.errors';
import {
  ensurePayload,
  parseDateString,
  parseOptionalPositiveInt,
  parsePositiveInt,
} from '../checklist-common/checklists.validation';
import {
  type ChecklistAnswerInput,
  type ChecklistAnswersDto,
  type ChecklistAnswersInput,
  type ChecklistVersionDto,
  type ChecklistVersionInput,
  type ChecklistWorkQuery,
  type ChecklistWorkQueryDto,
} from './checklist-work.types';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

export function parseChecklistWorkQuery(
  query: ChecklistWorkQueryDto,
): ChecklistWorkQuery {
  const dateFrom = parseOptionalDate(query.dateFrom, 'DATE_INVALID');
  const dateTo = parseOptionalDate(query.dateTo, 'DATE_INVALID');

  if (dateFrom && dateTo && dateFrom > dateTo) {
    throwChecklistBadRequest(
      'DATE_INVALID',
      'Дата начала не может быть позже даты окончания.',
    );
  }

  return {
    dateFrom,
    dateTo,
    equipmentVisibleId: parseOptionalPositiveInt(
      query.equipmentVisibleId,
      'EQUIPMENT_INVALID',
      'Некорректный ID оборудования.',
    ),
    eventId: parseOptionalPositiveInt(
      query.eventId,
      'EVENT_INVALID',
      'Некорректный ID события.',
    ),
    limit: parseLimit(query.limit),
    offset: parseOffset(query.offset),
    statuses: parseStatuses(query.status),
  };
}

export function parseChecklistVersionDto(
  dto: ChecklistVersionDto | undefined,
): ChecklistVersionInput {
  const payload = ensurePayload(dto, 'Передайте версию чек-листа.');

  return {
    version: parsePositiveInt(
      payload.version,
      'CHECKLIST_VERSION_INVALID',
      'Некорректная версия чек-листа.',
    ),
  };
}

export function parseChecklistAnswersDto(
  dto: ChecklistAnswersDto | undefined,
): ChecklistAnswersInput {
  const payload = ensurePayload(dto, 'Передайте ответы чек-листа.');

  if (!Array.isArray(payload.answers)) {
    throwChecklistBadRequest(
      'CHECKLIST_ANSWERS_INVALID',
      'Передайте массив ответов.',
    );
  }

  if (payload.answers.length === 0) {
    throwChecklistBadRequest(
      'CHECKLIST_UPDATE_EMPTY',
      'Передайте хотя бы один ответ.',
    );
  }

  return {
    answers: payload.answers.map(parseAnswerInput),
    version: parsePositiveInt(
      payload.version,
      'CHECKLIST_VERSION_INVALID',
      'Некорректная версия чек-листа.',
    ),
  };
}

function parseAnswerInput(value: unknown): ChecklistAnswerInput {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throwChecklistBadRequest(
      'CHECKLIST_QUESTION_INVALID',
      'Некорректный ответ чек-листа.',
    );
  }

  const payload = value as Record<string, unknown>;

  if (!('value' in payload)) {
    throwChecklistBadRequest(
      'CHECKLIST_ANSWER_VALUE_INVALID',
      'Передайте значение ответа.',
    );
  }

  return {
    checklistDetailId: parsePositiveInt(
      payload.checklistDetailId,
      'CHECKLIST_QUESTION_INVALID',
      'Некорректный вопрос чек-листа.',
    ),
    value: payload.value,
  };
}

function parseStatuses(value: unknown) {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  const values = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(',')
      : [value];

  return values.map((item) => {
    if (
      typeof item !== 'string' ||
      !Object.values(ChecklistStatus).includes(item as ChecklistStatus)
    ) {
      throwChecklistBadRequest(
        'CHECKLIST_STATUS_INVALID',
        'Некорректный статус чек-листа.',
      );
    }

    return item as ChecklistStatus;
  });
}

function parseLimit(value: unknown) {
  if (value === undefined || value === null || value === '') {
    return DEFAULT_LIMIT;
  }

  return Math.min(
    parsePositiveInt(value, 'LIMIT_INVALID', 'Некорректный лимит списка.'),
    MAX_LIMIT,
  );
}

function parseOffset(value: unknown) {
  if (value === undefined || value === null || value === '') {
    return 0;
  }

  const parsedValue = parseInteger(value);

  if (parsedValue === undefined || parsedValue < 0) {
    throwChecklistBadRequest('OFFSET_INVALID', 'Некорректное смещение списка.');
  }

  return parsedValue;
}

function parseInteger(value: unknown) {
  if (typeof value === 'number') {
    return Number.isSafeInteger(value) ? value : undefined;
  }

  if (typeof value === 'string' && /^(0|[1-9]\d*)$/.test(value)) {
    const parsedValue = Number(value);

    return Number.isSafeInteger(parsedValue) ? parsedValue : undefined;
  }

  return undefined;
}

function parseOptionalDate(value: unknown, code: string) {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  return new Date(`${parseDateString(value, code)}T00:00:00.000Z`);
}
