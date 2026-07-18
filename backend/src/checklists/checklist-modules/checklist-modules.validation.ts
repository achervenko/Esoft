import {
  ensurePayload,
  parseOptionalBoolean,
  parseOptionalString,
  parsePagination,
  parsePositiveInt,
  parseRequiredString,
  parseSearch,
  parseSortDirection,
  assertUniqueIds,
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

export type ChecklistReorderPayloadDto = {
  items?: unknown;
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
      : sortBy === 'name' || sortBy === 'sortOrder'
        ? 'asc'
        : 'desc',
  };
}

export function parseChecklistModuleReorderPayload(
  dto: ChecklistReorderPayloadDto | undefined,
) {
  const payload = ensurePayload(dto, 'Передайте порядок модулей чек-листа.');

  if (!Array.isArray(payload.items)) {
    throwChecklistBadRequest(
      'CHECKLIST_MODULE_ORDER_ITEMS_INVALID',
      'Передайте список модулей для изменения порядка.',
    );
  }

  const items = payload.items.map((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      throwChecklistBadRequest(
        'CHECKLIST_MODULE_ORDER_ITEM_INVALID',
        'Некорректная запись порядка модулей.',
      );
    }

    const itemPayload = item as { id?: unknown; sortOrder?: unknown };

    return {
      id: parsePositiveInt(
        itemPayload.id,
        'CHECKLIST_MODULE_ID_INVALID',
        'Некорректный модуль чек-листа.',
      ),
      sortOrder: parsePositiveInt(
        itemPayload.sortOrder,
        'CHECKLIST_MODULE_SORT_ORDER_INVALID',
        'Некорректный порядок модуля чек-листа.',
      ),
    };
  });

  assertUniqueIds(
    items.map((item) => item.id),
    'CHECKLIST_MODULE_ORDER_DUPLICATE',
  );
  assertSequentialOrder(
    items.map((item) => item.sortOrder),
    'CHECKLIST_MODULE_ORDER_INVALID',
    'Порядок модулей должен идти без пропусков с 1.',
  );

  return { items };
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
    return 'sortOrder' as const;
  }

  if (
    value === 'name' ||
    value === 'createdAt' ||
    value === 'updatedAt' ||
    value === 'sortOrder'
  ) {
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

function assertSequentialOrder(
  values: number[],
  code: string,
  message: string,
) {
  const orders = new Set(values);

  if (orders.size !== values.length) {
    throwChecklistBadRequest(code, 'Порядок содержит повторяющиеся позиции.');
  }

  for (let order = 1; order <= values.length; order += 1) {
    if (!orders.has(order)) {
      throwChecklistBadRequest(code, message);
    }
  }
}
