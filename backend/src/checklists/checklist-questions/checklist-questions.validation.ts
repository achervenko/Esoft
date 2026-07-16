import {
  ensurePayload,
  parseAnswerType,
  parseOptionalAnswerType,
  parseOptionalBoolean,
  parseOptionalPositiveInt,
  parsePagination,
  parsePositiveInt,
  parseRequiredString,
  parseSearch,
  parseSortDirection,
} from '../checklist-common/checklists.validation';
import { throwChecklistBadRequest } from '../checklist-common/checklists.errors';

export type ChecklistQuestionsQueryDto = {
  answerType?: unknown;
  isActive?: unknown;
  limit?: unknown;
  moduleId?: unknown;
  page?: unknown;
  search?: unknown;
  sortBy?: unknown;
  sortDirection?: unknown;
};

export type ChecklistQuestionPayloadDto = {
  answerType?: unknown;
  checklistModuleId?: unknown;
  questionText?: unknown;
};

export function parseChecklistQuestionsQuery(query: ChecklistQuestionsQueryDto) {
  const sortBy = parseQuestionSortBy(query.sortBy);

  return {
    ...parsePagination(query),
    answerType: parseOptionalAnswerType(query.answerType),
    isActive: parseOptionalBoolean(
      query.isActive,
      'CHECKLIST_QUESTION_ACTIVE_INVALID',
      'Некорректный признак активности.',
    ),
    moduleId: parseOptionalPositiveInt(
      query.moduleId,
      'CHECKLIST_MODULE_ID_INVALID',
      'Некорректный модуль чек-листа.',
    ),
    search: parseSearch(query.search),
    sortBy,
    sortDirection: hasValue(query.sortDirection)
      ? parseSortDirection(query.sortDirection)
      : sortBy === 'questionText'
        ? 'asc'
        : 'desc',
  };
}

export function parseChecklistQuestionPayload(
  dto: ChecklistQuestionPayloadDto | undefined,
) {
  const payload = ensurePayload(dto, 'Передайте данные вопроса.');

  return {
    answerType: parseAnswerType(payload.answerType),
    checklistModuleId: parsePositiveInt(
      payload.checklistModuleId,
      'CHECKLIST_MODULE_ID_INVALID',
      'Некорректный модуль чек-листа.',
    ),
    questionText: parseChecklistQuestionText(payload.questionText),
  };
}

export function parseChecklistQuestionUpdatePayload(
  dto: ChecklistQuestionPayloadDto | undefined,
) {
  const payload = ensurePayload(dto, 'Передайте данные вопроса.');
  const result: {
    answerType?: ReturnType<typeof parseAnswerType>;
    checklistModuleId?: number;
    questionText?: string;
  } = {};

  if ('answerType' in payload) {
    result.answerType = parseAnswerType(payload.answerType);
  }

  if ('checklistModuleId' in payload) {
    result.checklistModuleId = parsePositiveInt(
      payload.checklistModuleId,
      'CHECKLIST_MODULE_ID_INVALID',
      'Некорректный модуль чек-листа.',
    );
  }

  if ('questionText' in payload) {
    result.questionText = parseChecklistQuestionText(payload.questionText);
  }

  if (Object.keys(result).length === 0) {
    throwChecklistBadRequest(
      'CHECKLIST_QUESTION_UPDATE_EMPTY',
      'Передайте хотя бы одно поле для изменения.',
    );
  }

  return result;
}

function parseChecklistQuestionText(value: unknown) {
  return parseRequiredString(value, {
    code: 'CHECKLIST_QUESTION_TEXT_REQUIRED',
    maxLength: 2000,
    requiredMessage: 'Укажите текст вопроса.',
    tooLongCode: 'CHECKLIST_QUESTION_TEXT_TOO_LONG',
    tooLongMessage: 'Текст вопроса слишком длинный.',
  });
}

function parseQuestionSortBy(value: unknown) {
  if (value === undefined || value === null || value === '') {
    return 'questionText' as const;
  }

  if (
    value === 'questionText' ||
    value === 'createdAt' ||
    value === 'updatedAt'
  ) {
    return value;
  }

  throwChecklistBadRequest(
    'CHECKLIST_QUESTION_SORT_INVALID',
    'Некорректное поле сортировки вопросов.',
  );
}

function hasValue(value: unknown) {
  return value !== undefined && value !== null && value !== '';
}
