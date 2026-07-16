import {
  assertUniqueIds,
  ensurePayload,
  parseBoolean,
  parsePositiveInt,
} from '../checklist-common/checklists.validation';
import { throwChecklistBadRequest } from '../checklist-common/checklists.errors';
import type {
  AddTemplateModuleDto,
  AddTemplateQuestionDto,
  ModuleOrderDto,
  QuestionOrderDto,
  UpdateTemplateQuestionDto,
} from './checklist-templates.dto';
import { parseRequiredVersion } from './checklist-template-validation.utils';

export function parseAddTemplateModuleDto(
  dto: AddTemplateModuleDto | undefined,
) {
  const payload = ensurePayload(dto, 'Передайте данные модуля шаблона.');

  return {
    checklistModuleId: parsePositiveInt(
      payload.checklistModuleId,
      'CHECKLIST_MODULE_ID_INVALID',
      'Некорректный модуль чек-листа.',
    ),
    version: parseRequiredVersion(payload.version),
  };
}

export function parseAddTemplateQuestionDto(
  dto: AddTemplateQuestionDto | undefined,
) {
  const payload = ensurePayload(dto, 'Передайте данные вопроса шаблона.');

  return {
    checklistQuestionId: parsePositiveInt(
      payload.checklistQuestionId,
      'CHECKLIST_QUESTION_ID_INVALID',
      'Некорректный вопрос чек-листа.',
    ),
    isRequired:
      payload.isRequired === undefined
        ? true
        : parseBoolean(
            payload.isRequired,
            'CHECKLIST_TEMPLATE_REQUIRED_INVALID',
            'Некорректный признак обязательности.',
          ),
    version: parseRequiredVersion(payload.version),
  };
}

export function parseUpdateTemplateQuestionDto(
  dto: UpdateTemplateQuestionDto | undefined,
) {
  const payload = ensurePayload(dto, 'Передайте данные вопроса шаблона.');

  return {
    isRequired: parseBoolean(
      payload.isRequired,
      'CHECKLIST_TEMPLATE_REQUIRED_INVALID',
      'Некорректный признак обязательности.',
    ),
    version: parseRequiredVersion(payload.version),
  };
}

export function parseModuleOrderDto(dto: ModuleOrderDto | undefined) {
  const payload = ensurePayload(dto, 'Передайте порядок модулей.');
  const moduleIds = parseIdsArray(payload.moduleIds, 'moduleIds');

  assertUniqueIds(moduleIds);

  return {
    moduleIds,
    version: parseRequiredVersion(payload.version),
  };
}

export function parseQuestionOrderDto(dto: QuestionOrderDto | undefined) {
  const payload = ensurePayload(dto, 'Передайте порядок вопросов.');
  const questionIds = parseIdsArray(payload.questionIds, 'questionIds');

  assertUniqueIds(questionIds);

  return {
    questionIds,
    version: parseRequiredVersion(payload.version),
  };
}

function parseIdsArray(value: unknown, fieldName: string) {
  if (!Array.isArray(value)) {
    throwChecklistBadRequest(
      'CHECKLIST_TEMPLATE_ORDER_INVALID',
      `Передайте массив ${fieldName}.`,
    );
  }

  return value.map((item) =>
    parsePositiveInt(
      item,
      'CHECKLIST_TEMPLATE_ORDER_INVALID',
      'Некорректный идентификатор в порядке.',
    ),
  );
}
