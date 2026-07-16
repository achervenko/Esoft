import {
  parseOptionalBoolean,
  parseOptionalPositiveInt,
  parsePagination,
  parseSearch,
  parseSortDirection,
} from '../checklist-common/checklists.validation';
import { throwChecklistBadRequest } from '../checklist-common/checklists.errors';
import type { ChecklistTemplatesQueryDto } from './checklist-templates.dto';

export function parseChecklistTemplatesQuery(query: ChecklistTemplatesQueryDto) {
  const sortBy = parseTemplateSortBy(query.sortBy);

  return {
    ...parsePagination(query),
    equipmentModelId: parseOptionalPositiveInt(
      query.equipmentModelId,
      'EQUIPMENT_MODEL_ID_INVALID',
      'Некорректная модель оборудования.',
    ),
    isActive: parseOptionalBoolean(
      query.isActive,
      'CHECKLIST_TEMPLATE_ACTIVE_INVALID',
      'Некорректный признак активности.',
    ),
    isPublished: parseOptionalBoolean(
      query.isPublished,
      'CHECKLIST_TEMPLATE_PUBLISHED_INVALID',
      'Некорректный признак публикации.',
    ),
    maintenanceTypeId: parseOptionalPositiveInt(
      query.maintenanceTypeId,
      'MAINTENANCE_TYPE_ID_INVALID',
      'Некорректный вид обслуживания.',
    ),
    search: parseSearch(query.search),
    sortBy,
    sortDirection: hasValue(query.sortDirection)
      ? parseSortDirection(query.sortDirection)
      : 'desc',
    state: parseTemplateState(query.state),
  };
}

function parseTemplateState(value: unknown) {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  if (value === 'DRAFT' || value === 'ACTIVE' || value === 'ARCHIVED') {
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

