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

  it('keeps legacy moduleId query filter compatibility', () => {
    expect(
      parseChecklistQuestionsQuery({
        moduleId: '4',
      }),
    ).toMatchObject({
      checklistModuleId: 4,
    });
  });

  it('rejects conflicting module query filter aliases', () => {
    expectBadRequestCode(() =>
      parseChecklistQuestionsQuery({
        checklistModuleId: '5',
        moduleId: '4',
      }),
    ).toBe('CHECKLIST_QUESTION_MODULE_FILTER_CONFLICT');
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
