import {
  ensurePayload,
  parseOptionalBoolean,
  parseOptionalString,
  parsePagination,
  parseRequiredString,
  parseSearch,
  parseSortDirection,
} from '../checklist-common/checklists.validation';
import { throwChecklistBadRequest } from '../checklist-common/checklists.errors';

export type ChecklistModulesQueryDto = {
  isActive?: unknown;
  limit?: unknown;
  page?: unknown;
  search?: unknown;
  sortBy?: unknown;
  sortDirection?: unknown;
};

export type ChecklistModulePayloadDto = {
  description?: unknown;
  name?: unknown;
};

export function parseChecklistModulesQuery(query: ChecklistModulesQueryDto) {
  const sortBy = parseModuleSortBy(query.sortBy);

  return {
    ...parsePagination(query),
    isActive: parseOptionalBoolean(
      query.isActive,
      'CHECKLIST_MODULE_ACTIVE_INVALID',
      'Некорректный признак активности.',
    ),
    search: parseSearch(query.search),
    sortBy,
    sortDirection: hasValue(query.sortDirection)
      ? parseSortDirection(query.sortDirection)
      : sortBy === 'name'
        ? 'asc'
        : 'desc',
  };
}

export function parseChecklistModulePayload(
  dto: ChecklistModulePayloadDto | undefined,
) {
  const payload = ensurePayload(dto, 'Передайте данные модуля чек-листа.');

  return {
    description: parseOptionalString(payload.description, {}),
    name: parseChecklistModuleName(payload.name),
  };
}

export function parseChecklistModuleUpdatePayload(
  dto: ChecklistModulePayloadDto | undefined,
) {
  const payload = ensurePayload(dto, 'Передайте данные модуля чек-листа.');
  const result: {
    description?: string | null;
    name?: string;
  } = {};

  if ('description' in payload) {
    result.description = parseOptionalString(payload.description, {});
  }

  if ('name' in payload) {
    result.name = parseChecklistModuleName(payload.name);
  }

  if (Object.keys(result).length === 0) {
    throwChecklistBadRequest(
      'CHECKLIST_MODULE_UPDATE_EMPTY',
      'Передайте хотя бы одно поле для изменения.',
    );
  }

  return result;
}

function parseChecklistModuleName(value: unknown) {
  return parseRequiredString(value, {
    code: 'CHECKLIST_MODULE_NAME_REQUIRED',
    maxLength: 128,
    requiredMessage: 'Укажите название модуля чек-листа.',
    tooLongCode: 'CHECKLIST_MODULE_NAME_TOO_LONG',
    tooLongMessage: 'Название модуля чек-листа слишком длинное.',
  });
}

function parseModuleSortBy(value: unknown) {
  if (value === undefined || value === null || value === '') {
    return 'name' as const;
  }

  if (value === 'name' || value === 'createdAt' || value === 'updatedAt') {
    return value;
  }

  throwChecklistBadRequest(
    'CHECKLIST_MODULE_SORT_INVALID',
    'Некорректное поле сортировки модулей.',
  );
}

function hasValue(value: unknown) {
  return value !== undefined && value !== null && value !== '';
}
