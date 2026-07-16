import { ChecklistAnswerType } from '@prisma/client';
import { throwChecklistBadRequest } from './checklists.errors';

const MAX_SEARCH_LENGTH = 300;

export type PaginationInput = {
  limit: number;
  page: number;
};

export type SortDirection = 'asc' | 'desc';

export function ensurePayload<T extends Record<string, unknown>>(
  dto: T | undefined,
  message = 'Передайте данные.',
): T {
  if (!dto || typeof dto !== 'object' || Array.isArray(dto)) {
    throwChecklistBadRequest('REQUEST_BODY_REQUIRED', message);
  }

  return dto;
}

export function parseRequiredString(
  value: unknown,
  params: {
    code: string;
    maxLength: number;
    requiredMessage: string;
    tooLongCode: string;
    tooLongMessage: string;
  },
) {
  if (typeof value !== 'string' || !value.trim()) {
    throwChecklistBadRequest(params.code, params.requiredMessage);
  }

  const text = value.trim();

  if (text.length > params.maxLength) {
    throwChecklistBadRequest(params.tooLongCode, params.tooLongMessage);
  }

  return text;
}

export function parseOptionalString(
  value: unknown,
  params: { maxLength?: number; tooLongCode?: string; tooLongMessage?: string },
) {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  if (typeof value !== 'string') {
    throwChecklistBadRequest('TEXT_FIELD_INVALID', 'Некорректный текст.');
  }

  const text = value.trim();

  if (!text) {
    return null;
  }

  if (params.maxLength && text.length > params.maxLength) {
    throwChecklistBadRequest(
      params.tooLongCode ?? 'TEXT_FIELD_TOO_LONG',
      params.tooLongMessage ?? 'Текст слишком длинный.',
    );
  }

  return text;
}

export function parsePositiveInt(value: unknown, code: string, message: string) {
  const parsedValue =
    typeof value === 'number'
      ? value
      : typeof value === 'string' && value.trim()
        ? Number(value)
        : NaN;

  if (!Number.isInteger(parsedValue) || parsedValue <= 0) {
    throwChecklistBadRequest(code, message);
  }

  return parsedValue;
}

export function parseOptionalPositiveInt(
  value: unknown,
  code: string,
  message: string,
) {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  return parsePositiveInt(value, code, message);
}

export function parseBoolean(value: unknown, code: string, message: string) {
  if (value === true || value === 'true') {
    return true;
  }

  if (value === false || value === 'false') {
    return false;
  }

  throwChecklistBadRequest(code, message);
}

export function parseOptionalBoolean(
  value: unknown,
  code: string,
  message: string,
) {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  return parseBoolean(value, code, message);
}

export function parsePagination(query: {
  limit?: unknown;
  page?: unknown;
}): PaginationInput {
  const page = hasQueryValue(query.page)
    ? parsePositiveInt(query.page, 'PAGE_INVALID', 'Некорректная страница.')
    : 1;
  const limit = hasQueryValue(query.limit)
    ? parsePositiveInt(
        query.limit,
        'LIMIT_INVALID',
        'Некорректный размер страницы.',
      )
    : 20;

  return {
    limit: Math.min(limit, 100),
    page,
  };
}

export function parseSortDirection(value: unknown): SortDirection {
  if (value === undefined || value === null || value === '') {
    return 'asc';
  }

  if (value === 'asc' || value === 'desc') {
    return value;
  }

  throwChecklistBadRequest(
    'SORT_DIRECTION_INVALID',
    'Некорректное направление сортировки.',
  );
}

export function parseSearch(value: unknown) {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value !== 'string') {
    throwChecklistBadRequest('SEARCH_INVALID', 'Некорректный поиск.');
  }

  const search = value.trim();

  if (search.length > MAX_SEARCH_LENGTH) {
    throwChecklistBadRequest(
      'SEARCH_TOO_LONG',
      'Поисковая строка слишком длинная.',
    );
  }

  return search || undefined;
}

function hasQueryValue(value: unknown) {
  return value !== undefined && value !== null && value !== '';
}

export function parseAnswerType(value: unknown) {
  if (
    typeof value === 'string' &&
    Object.values(ChecklistAnswerType).includes(value as ChecklistAnswerType)
  ) {
    return value as ChecklistAnswerType;
  }

  throwChecklistBadRequest(
    'CHECKLIST_ANSWER_TYPE_INVALID',
    'Некорректный тип ответа.',
  );
}

export function parseOptionalAnswerType(value: unknown) {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  return parseAnswerType(value);
}

export function assertUniqueIds(
  ids: number[],
  code = 'CHECKLIST_TEMPLATE_ORDER_INVALID',
) {
  if (new Set(ids).size !== ids.length) {
    throwChecklistBadRequest(code, 'Порядок содержит повторяющиеся записи.');
  }
}
