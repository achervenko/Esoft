import { throwMaintenanceSettingBadRequest } from './maintenance-settings.errors';
import type { MaintenanceSettingChecklistTemplateInput } from './maintenance-settings.types';

export function hasChecklistTemplatesPayload(payload: Record<string, unknown>) {
  return 'checklistTemplates' in payload;
}

export function parseChecklistTemplates(
  payload: Record<string, unknown>,
): MaintenanceSettingChecklistTemplateInput[] {
  if (!('checklistTemplates' in payload)) {
    return [];
  }

  return parseChecklistTemplateItems(payload.checklistTemplates);
}

export function parseRequiredPositiveInteger(
  value: unknown,
  code: string,
  message: string,
) {
  if (typeof value === 'number' && Number.isSafeInteger(value) && value > 0) {
    return value;
  }

  if (typeof value === 'string' && /^[1-9]\d*$/.test(value)) {
    const parsed = Number(value);

    if (Number.isSafeInteger(parsed)) {
      return parsed;
    }
  }

  throwMaintenanceSettingBadRequest(code, message);
}

function parseChecklistTemplateItems(
  value: unknown,
): MaintenanceSettingChecklistTemplateInput[] {
  if (value === undefined || value === null) {
    return [];
  }

  if (!Array.isArray(value)) {
    throwMaintenanceSettingBadRequest(
      'CHECKLIST_TEMPLATES_INVALID',
      'Некорректные шаблоны чек-листов.',
    );
  }

  const checklistTemplateIds = new Set<number>();
  const sortOrders = new Set<number>();

  const items = value.map((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      throwMaintenanceSettingBadRequest(
        'CHECKLIST_TEMPLATE_INVALID',
        'Некорректный шаблон чек-листа.',
      );
    }

    const payload = item as Record<string, unknown>;
    const checklistTemplateId = parseRequiredPositiveInteger(
      payload.checklistTemplateId,
      'CHECKLIST_TEMPLATE_ID_INVALID',
      'Некорректный шаблон чек-листа.',
    );
    const sortOrder = parseRequiredPositiveInteger(
      payload.sortOrder,
      'CHECKLIST_TEMPLATE_SORT_ORDER_INVALID',
      'Некорректный порядок шаблона чек-листа.',
    );
    const isRequired =
      payload.isRequired === undefined
        ? true
        : parseRequiredBoolean(
            payload.isRequired,
            'CHECKLIST_TEMPLATE_REQUIRED_INVALID',
            'Некорректный признак обязательности чек-листа.',
          );

    if (checklistTemplateIds.has(checklistTemplateId)) {
      throwMaintenanceSettingBadRequest(
        'CHECKLIST_TEMPLATE_DUPLICATE',
        'Шаблон чек-листа указан несколько раз.',
      );
    }

    if (sortOrders.has(sortOrder)) {
      throwMaintenanceSettingBadRequest(
        'CHECKLIST_TEMPLATE_SORT_ORDER_DUPLICATE',
        'Порядок шаблона чек-листа указан несколько раз.',
      );
    }

    checklistTemplateIds.add(checklistTemplateId);
    sortOrders.add(sortOrder);

    return { checklistTemplateId, isRequired, sortOrder };
  });

  assertSequentialSortOrder(sortOrders, items.length);

  return items;
}

function parseRequiredBoolean(value: unknown, code: string, message: string) {
  if (typeof value === 'boolean') {
    return value;
  }

  throwMaintenanceSettingBadRequest(code, message);
}

function assertSequentialSortOrder(sortOrders: Set<number>, itemCount: number) {
  for (let sortOrder = 1; sortOrder <= itemCount; sortOrder += 1) {
    if (!sortOrders.has(sortOrder)) {
      throwMaintenanceSettingBadRequest(
        'CHECKLIST_TEMPLATE_SORT_ORDER_SEQUENCE_INVALID',
        'Порядок шаблонов чек-листов должен быть непрерывным.',
      );
    }
  }
}
