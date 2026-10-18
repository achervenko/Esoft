import { BadRequestException } from '@nestjs/common';
import {
  parseChecklistQuestionPayload,
  parseChecklistQuestionUpdatePayload,
  parseChecklistQuestionsQuery,
} from './checklist-questions.validation';

describe('checklist question validation', () => {
  it('rejects unsupported answer type', () => {
    expect(() =>
      parseChecklistQuestionPayload({
        answerType: 'FILE',
        checklistModuleId: 1,
        questionText: 'Фото приложено',
      }),
    ).toThrow(BadRequestException);
  });

  it('parses query filters', () => {
    expect(
      parseChecklistQuestionsQuery({
        answerType: 'BOOLEAN',
        checklistModuleId: '3',
        isActive: 'true',
      }),
    ).toMatchObject({
      answerType: 'BOOLEAN',
      checklistModuleId: 3,
      isActive: true,
    });
  });

  it.each([
    { moduleId: '4' },
    { checklistModuleId: '5', moduleId: '4' },
    { moduleId: '' },
    { unexpected: 'value' },
  ])('rejects unknown query fields %p', (query) => {
    expectBadRequestCode(() =>
      parseChecklistQuestionsQuery(query as never),
    ).toBe('CHECKLIST_QUESTION_QUERY_FIELD_UNKNOWN');
  });

  it.each([null, 'null'])(
    'preserves the unassigned module filter %p',
    (value) => {
      expect(
        parseChecklistQuestionsQuery({ checklistModuleId: value }),
      ).toMatchObject({ checklistModuleId: null });
    },
  );

  it('does not filter by module when omitted', () => {
    expect(parseChecklistQuestionsQuery({}).checklistModuleId).toBeUndefined();
  });

  it.each([
    { query: {}, sortBy: 'createdAt', sortDirection: 'desc' },
    {
      query: { checklistModuleId: '3' },
      sortBy: 'sortOrder',
      sortDirection: 'asc',
    },
    {
      query: { checklistModuleId: null },
      sortBy: 'sortOrder',
      sortDirection: 'asc',
    },
    {
      query: { checklistModuleId: 'null' },
      sortBy: 'sortOrder',
      sortDirection: 'asc',
    },
    {
      query: { checklistModuleId: '' },
      sortBy: 'createdAt',
      sortDirection: 'desc',
    },
    {
      query: { sortBy: 'questionText' },
      sortBy: 'questionText',
      sortDirection: 'asc',
    },
    {
      query: {
        checklistModuleId: 'null',
        sortBy: 'updatedAt',
        sortDirection: 'asc',
      },
      sortBy: 'updatedAt',
      sortDirection: 'asc',
    },
  ])('chooses sorting for $query', ({ query, sortBy, sortDirection }) => {
    expect(parseChecklistQuestionsQuery(query)).toMatchObject({
      sortBy,
      sortDirection,
    });
  });
  it('rejects an unsupported explicit sort field', () => {
    expectBadRequestCode(() =>
      parseChecklistQuestionsQuery({ sortBy: 'unknown' }),
    ).toBe('CHECKLIST_QUESTION_SORT_INVALID');
  });
  it('allows partial update payloads', () => {
    expect(
      parseChecklistQuestionUpdatePayload({
        questionText: 'Новое описание проверки',
      }),
    ).toEqual({
      questionText: 'Новое описание проверки',
    });
  });

  it('rejects empty update payloads', () => {
    expect(() => parseChecklistQuestionUpdatePayload({})).toThrow(
      BadRequestException,
    );
  });
});

function expectBadRequestCode(action: () => unknown) {
  try {
    action();
  } catch (error) {
    if (error instanceof BadRequestException) {
      const response = error.getResponse();

      if (
        response &&
        typeof response === 'object' &&
        'code' in response &&
        typeof response.code === 'string'
      ) {
        return expect(response.code);
      }
    }

    throw error;
  }

  throw new Error('Expected BadRequestException to be thrown.');
}
