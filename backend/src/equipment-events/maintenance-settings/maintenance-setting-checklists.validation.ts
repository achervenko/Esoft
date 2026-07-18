import { throwMaintenanceSettingBadRequest } from './maintenance-settings.errors';

export function hasDefaultChecklistTemplatePayload(
  payload: Record<string, unknown>,
) {
  return 'defaultChecklistTemplateId' in payload;
}

export function parseNullableChecklistTemplateId(
  payload: Record<string, unknown>,
) {
  if (
    payload.defaultChecklistTemplateId === null ||
    payload.defaultChecklistTemplateId === undefined
  ) {
    return null;
  }

  return parseRequiredPositiveInteger(
    payload.defaultChecklistTemplateId,
    'DEFAULT_CHECKLIST_TEMPLATE_REQUIRED',
    'Укажите корректный шаблон чек-листа по умолчанию.',
  );
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
