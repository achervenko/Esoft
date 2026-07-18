import {
  parseOptionalBoolean,
  parsePagination,
  parseSearch,
  parseSortDirection,
} from '../checklist-common/checklists.validation';
import { throwChecklistBadRequest } from '../checklist-common/checklists.errors';
import type { ChecklistTemplatesQueryDto } from './checklist-templates.dto';

export function parseChecklistTemplatesQuery(
  query: ChecklistTemplatesQueryDto,
) {
  const sortBy = parseTemplateSortBy(query.sortBy);
  const state = parseTemplateState(query.state);

  if ('isPublished' in query) {
    throwChecklistBadRequest(
      'CHECKLIST_TEMPLATE_PUBLISHED_FILTER_FORBIDDEN',
      'Фильтрация по техническому признаку ввода в действие недоступна.',
    );
  }

  if (state !== undefined && hasValue(query.isActive)) {
    throwChecklistBadRequest(
      'CHECKLIST_TEMPLATE_STATE_FILTER_CONFLICT',
      'При фильтрации по состоянию шаблона не передавайте отдельный признак активности.',
    );
  }

  return {
    ...parsePagination(query),
    isActive: parseOptionalBoolean(
      query.isActive,
      'CHECKLIST_TEMPLATE_ACTIVE_INVALID',
      'Некорректный признак активности.',
    ),
    search: parseSearch(query.search),
    sortBy,
    sortDirection: hasValue(query.sortDirection)
      ? parseSortDirection(query.sortDirection)
      : 'desc',
    state,
  };
}

function parseTemplateState(value: unknown) {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  if (value === 'ACTIVE' || value === 'ARCHIVED') {
    return value;
  }

  throwChecklistBadRequest(
    'CHECKLIST_TEMPLATE_STATE_INVALID',
    'Некорректное состояние шаблона.',
  );
}

function parseTemplateSortBy(value: unknown) {
  if (value === undefined || value === null || value === '') {
    return 'updatedAt' as const;
  }

  if (
    value === 'name' ||
    value === 'createdAt' ||
    value === 'updatedAt' ||
    value === 'publishedAt' ||
    value === 'archivedAt'
  ) {
    return value;
  }

  throwChecklistBadRequest(
    'CHECKLIST_TEMPLATE_SORT_INVALID',
    'Некорректное поле сортировки шаблонов.',
  );
}

function hasValue(value: unknown) {
  return value !== undefined && value !== null && value !== '';
}
