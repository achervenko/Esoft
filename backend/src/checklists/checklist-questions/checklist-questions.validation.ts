  import {
    ensurePayload,
    parseAnswerType,
    parseOptionalAnswerType,
    parseOptionalBoolean,
    parsePagination,
    parsePositiveInt,
    parseRequiredString,
    parseSearch,
    parseSortDirection,
    assertUniqueIds,
  } from '../checklist-common/checklists.validation';
  import { throwChecklistBadRequest } from '../checklist-common/checklists.errors';

  export type ChecklistQuestionsQueryDto = {
    answerType?: unknown;
    checklistModuleId?: unknown;
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

  export type ChecklistQuestionReorderPayloadDto = {
    items?: unknown;
  };

  export function parseChecklistQuestionsQuery(
    query: ChecklistQuestionsQueryDto,
  ) {
    const sortBy = parseQuestionSortBy(query.sortBy);
    const checklistModuleIdInput = query.checklistModuleId ?? query.moduleId;

    return {
      ...parsePagination(query),
      answerType: parseOptionalAnswerType(query.answerType),
      isActive: parseOptionalBoolean(
        query.isActive,
        'CHECKLIST_QUESTION_ACTIVE_INVALID',
        'Некорректный признак активности.',
      ),
      checklistModuleId: parseOptionalNullableModuleId(checklistModuleIdInput),
      search: parseSearch(query.search),
      sortBy,
      sortDirection: hasValue(query.sortDirection)
        ? parseSortDirection(query.sortDirection)
        : sortBy === 'questionText' || sortBy === 'sortOrder'
          ? 'asc'
          : 'desc',
    };
  }

  export function parseChecklistQuestionReorderPayload(
    dto: ChecklistQuestionReorderPayloadDto | undefined,
  ) {
    const payload = ensurePayload(dto, 'Передайте порядок вопросов чек-листа.');

    if (!Array.isArray(payload.items)) {
      throwChecklistBadRequest(
        'CHECKLIST_QUESTION_ORDER_ITEMS_INVALID',
        'Передайте список вопросов для изменения порядка.',
      );
    }

    const items = payload.items.map((item) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) {
        throwChecklistBadRequest(
          'CHECKLIST_QUESTION_ORDER_ITEM_INVALID',
          'Некорректная запись порядка вопросов.',
        );
      }

      const itemPayload = item as { id?: unknown; sortOrder?: unknown };

      return {
        id: parsePositiveInt(
          itemPayload.id,
          'CHECKLIST_QUESTION_ID_INVALID',
          'Некорректный вопрос чек-листа.',
        ),
        sortOrder: parsePositiveInt(
          itemPayload.sortOrder,
          'CHECKLIST_QUESTION_SORT_ORDER_INVALID',
          'Некорректный порядок вопроса чек-листа.',
        ),
      };
    });

    assertUniqueIds(
      items.map((item) => item.id),
      'CHECKLIST_QUESTION_ORDER_DUPLICATE',
    );
    assertSequentialOrder(
      items.map((item) => item.sortOrder),
      'CHECKLIST_QUESTION_ORDER_INVALID',
      'Порядок вопросов должен идти без пропусков с 1.',
    );

    return { items };
  }

  export function parseChecklistQuestionPayload(
    dto: ChecklistQuestionPayloadDto | undefined,
  ) {
    const payload = ensurePayload(dto, 'Передайте данные вопроса.');

    return {
      answerType: parseAnswerType(payload.answerType),
      checklistModuleId: parseNullableModuleId(payload.checklistModuleId),
      questionText: parseChecklistQuestionText(payload.questionText),
    };
  }

  export function parseChecklistQuestionUpdatePayload(
    dto: ChecklistQuestionPayloadDto | undefined,
  ) {
    const payload = ensurePayload(dto, 'Передайте данные вопроса.');
    const result: {
      answerType?: ReturnType<typeof parseAnswerType>;
      checklistModuleId?: number | null;
      questionText?: string;
    } = {};

    if ('answerType' in payload) {
      result.answerType = parseAnswerType(payload.answerType);
    }

    if ('checklistModuleId' in payload) {
      result.checklistModuleId = parseNullableModuleId(payload.checklistModuleId);
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
      return 'sortOrder' as const;
    }

    if (
      value === 'questionText' ||
      value === 'createdAt' ||
      value === 'updatedAt' ||
      value === 'sortOrder'
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

  function parseNullableModuleId(value: unknown) {
    if (value === null) {
      return null;
    }

    return parsePositiveInt(
      value,
      'CHECKLIST_MODULE_ID_INVALID',
      'Некорректный модуль чек-листа.',
    );
  }

  function parseOptionalNullableModuleId(value: unknown) {
    if (value === undefined || value === '') {
      return undefined;
    }

    if (value === null || value === 'null') {
      return null;
    }

    return parseNullableModuleId(value);
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
