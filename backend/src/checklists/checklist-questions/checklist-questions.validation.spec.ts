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
        isActive: 'true',
        moduleId: '3',
      }),
    ).toMatchObject({
      answerType: 'BOOLEAN',
      isActive: true,
      moduleId: 3,
    });
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
