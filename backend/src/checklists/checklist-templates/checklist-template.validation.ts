import {
  assertUniqueIds,
  ensurePayload,
  parseOptionalString,
  parsePositiveInt,
  parseRequiredString,
} from '../checklist-common/checklists.validation';
import { throwChecklistBadRequest } from '../checklist-common/checklists.errors';
import type { ChecklistTemplatePayloadDto } from './checklist-templates.dto';

export function parseChecklistTemplatePayload(
  dto: ChecklistTemplatePayloadDto | undefined,
) {
  const payload = ensurePayload(dto, 'Передайте данные шаблона.');
  assertNoTemplateServiceFields(payload);

  return {
    description: parseOptionalString(payload.description, {}),
    name: parseTemplateName(payload.name),
    modules: parseTemplateModules(payload.modules),
  };
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

function assertNoTemplateServiceFields(payload: Record<string, unknown>) {
  const forbiddenFields = [
    'equipmentModelId',
    'isActive',
    'isPublished',
    'maintenanceTypeId',
  ];
  const forbiddenField = forbiddenFields.find((field) => field in payload);

  if (forbiddenField) {
    throwChecklistBadRequest(
      'CHECKLIST_TEMPLATE_FIELD_FORBIDDEN',
      `Поле ${forbiddenField} нельзя изменить этим методом.`,
    );
  }
}

function parseTemplateModules(value: unknown) {
  if (!Array.isArray(value) || value.length === 0) {
    throwChecklistBadRequest(
      'CHECKLIST_TEMPLATE_EMPTY',
      'Добавьте хотя бы один модуль.',
    );
  }

  const modules = value.map((item, index) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      throwChecklistBadRequest(
        'CHECKLIST_TEMPLATE_MODULE_INVALID',
        'Некорректный модуль шаблона.',
      );
    }

    const modulePayload = item as Record<string, unknown>;
    const questions = parseTemplateQuestions(modulePayload.questions);

    return {
      checklistModuleId: parsePositiveInt(
        modulePayload.checklistModuleId,
        'CHECKLIST_MODULE_ID_INVALID',
        'Некорректный модуль чек-листа.',
      ),
      questions,
      sortOrder:
        modulePayload.sortOrder === undefined
          ? index + 1
          : parsePositiveInt(
              modulePayload.sortOrder,
              'CHECKLIST_TEMPLATE_ORDER_INVALID',
              'Некорректный порядок шаблона.',
            ),
    };
  });

  assertUniqueIds(
    modules.map((module) => module.checklistModuleId),
    'CHECKLIST_TEMPLATE_MODULE_DUPLICATE',
  );
  assertUniqueIds(
    modules.map((module) => module.sortOrder),
    'CHECKLIST_TEMPLATE_ORDER_INVALID',
  );
  assertSequentialOrder(modules.map((module) => module.sortOrder));

  return modules;
}

function parseTemplateQuestions(value: unknown) {
  if (!Array.isArray(value) || value.length === 0) {
    throwChecklistBadRequest(
      'CHECKLIST_TEMPLATE_MODULE_EMPTY',
      'В каждом модуле должен быть хотя бы один вопрос.',
    );
  }

  const questions = value.map((item, index) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      throwChecklistBadRequest(
        'CHECKLIST_TEMPLATE_QUESTION_INVALID',
        'Некорректный вопрос шаблона.',
      );
    }

    const questionPayload = item as Record<string, unknown>;

    return {
      checklistQuestionId: parsePositiveInt(
        questionPayload.checklistQuestionId,
        'CHECKLIST_QUESTION_ID_INVALID',
        'Некорректный вопрос чек-листа.',
      ),
      isRequired:
        questionPayload.isRequired === undefined
          ? true
          : parseTemplateQuestionRequired(questionPayload.isRequired),
      sortOrder:
        questionPayload.sortOrder === undefined
          ? index + 1
          : parsePositiveInt(
              questionPayload.sortOrder,
              'CHECKLIST_TEMPLATE_ORDER_INVALID',
              'Некорректный порядок шаблона.',
            ),
    };
  });

  assertUniqueIds(
    questions.map((question) => question.checklistQuestionId),
    'CHECKLIST_TEMPLATE_QUESTION_DUPLICATE',
  );
  assertUniqueIds(
    questions.map((question) => question.sortOrder),
    'CHECKLIST_TEMPLATE_ORDER_INVALID',
  );
  assertSequentialOrder(questions.map((question) => question.sortOrder));

  return questions;
}

function assertSequentialOrder(values: number[]) {
  const sortedValues = [...values].sort((left, right) => left - right);

  sortedValues.forEach((value, index) => {
    if (value !== index + 1) {
      throwChecklistBadRequest(
        'CHECKLIST_TEMPLATE_ORDER_INVALID',
        'Порядок шаблона должен быть последовательным.',
      );
    }
  });
}

function parseTemplateQuestionRequired(value: unknown) {
  if (value === true || value === false) {
    return value;
  }

  throwChecklistBadRequest(
    'CHECKLIST_TEMPLATE_QUESTION_REQUIRED_INVALID',
    'Некорректный признак обязательности вопроса.',
  );
}
