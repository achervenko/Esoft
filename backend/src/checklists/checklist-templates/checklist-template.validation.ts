import {
  ensurePayload,
  parseOptionalString,
  parsePositiveInt,
  parseRequiredString,
} from '../checklist-common/checklists.validation';
import { throwChecklistBadRequest } from '../checklist-common/checklists.errors';
import type {
  ChecklistTemplatePayloadDto,
  ChecklistTemplateUpdateDto,
} from './checklist-templates.dto';
import { parseRequiredVersion } from './checklist-template-validation.utils';

export function parseChecklistTemplatePayload(
  dto: ChecklistTemplatePayloadDto | undefined,
) {
  const payload = ensurePayload(dto, 'Передайте данные шаблона.');

  return {
    description: parseOptionalString(payload.description, {}),
    equipmentModelId: parsePositiveInt(
      payload.equipmentModelId,
      'EQUIPMENT_MODEL_ID_INVALID',
      'Некорректная модель оборудования.',
    ),
    maintenanceTypeId: parsePositiveInt(
      payload.maintenanceTypeId,
      'MAINTENANCE_TYPE_ID_INVALID',
      'Некорректный вид обслуживания.',
    ),
    name: parseTemplateName(payload.name),
  };
}

export function parseChecklistTemplateUpdatePayload(
  dto: ChecklistTemplateUpdateDto | undefined,
) {
  const payload = ensurePayload(dto, 'Передайте данные шаблона.');
  assertNoTemplateUpdateServiceFields(payload);

  const result: {
    description?: string | null;
    equipmentModelId?: number;
    maintenanceTypeId?: number;
    name?: string;
    version: number;
  } = {
    version: parseRequiredVersion(payload.version),
  };
  let hasUpdateField = false;

  if ('description' in payload) {
    result.description = parseOptionalString(payload.description, {});
    hasUpdateField = true;
  }

  if ('equipmentModelId' in payload) {
    result.equipmentModelId = parsePositiveInt(
      payload.equipmentModelId,
      'EQUIPMENT_MODEL_ID_INVALID',
      'Некорректная модель оборудования.',
    );
    hasUpdateField = true;
  }

  if ('maintenanceTypeId' in payload) {
    result.maintenanceTypeId = parsePositiveInt(
      payload.maintenanceTypeId,
      'MAINTENANCE_TYPE_ID_INVALID',
      'Некорректный вид обслуживания.',
    );
    hasUpdateField = true;
  }

  if ('name' in payload) {
    result.name = parseTemplateName(payload.name);
    hasUpdateField = true;
  }

  if (!hasUpdateField) {
    throwChecklistBadRequest(
      'CHECKLIST_TEMPLATE_UPDATE_EMPTY',
      'Передайте хотя бы одно поле для изменения.',
    );
  }

  return result;
}

export function parseTemplateName(value: unknown) {
  return parseRequiredString(value, {
    code: 'CHECKLIST_TEMPLATE_NAME_REQUIRED',
    maxLength: 160,
    requiredMessage: 'Укажите название шаблона.',
    tooLongCode: 'CHECKLIST_TEMPLATE_NAME_TOO_LONG',
    tooLongMessage: 'Название шаблона слишком длинное.',
  });
}

function assertNoTemplateUpdateServiceFields(
  payload: Record<string, unknown>,
) {
  const forbiddenFields = ['isActive', 'isPublished'];
  const forbiddenField = forbiddenFields.find((field) => field in payload);

  if (forbiddenField) {
    throwChecklistBadRequest(
      'CHECKLIST_TEMPLATE_FIELD_FORBIDDEN',
      `Поле ${forbiddenField} нельзя изменить этим методом.`,
    );
  }
}
