import { BadRequestException } from '@nestjs/common';
import { ChecklistResult } from '@prisma/client';
import {
  parseChecklistAnswersDto,
  parseChecklistCompleteDto,
} from './checklist-work.validation';

function expectBadRequestCode(action: () => unknown, code: string) {
  try {
    action();
  } catch (error) {
    expect(error).toBeInstanceOf(BadRequestException);
    expect((error as BadRequestException).getResponse()).toMatchObject({
      code,
    });
    return;
  }

  throw new Error(`Expected ${code} BadRequestException`);
}

describe('checklist work validation', () => {
  describe('parseChecklistCompleteDto', () => {
    it('requires result when checklist is completed', () => {
      expectBadRequestCode(
        () => parseChecklistCompleteDto({ version: 1 }),
        'CHECKLIST_RESULT_REQUIRED',
      );
    });

    it('rejects unknown completion result', () => {
      expectBadRequestCode(
        () => parseChecklistCompleteDto({ result: 'UNKNOWN', version: 1 }),
        'CHECKLIST_RESULT_INVALID',
      );
    });

    it('accepts a known completion result', () => {
      expect(
        parseChecklistCompleteDto({
          result: ChecklistResult.WITH_REMARKS,
          version: 1,
        }),
      ).toEqual({
        result: ChecklistResult.WITH_REMARKS,
        version: 1,
      });
    });
  });

  describe('parseChecklistAnswersDto', () => {
    it('rejects empty draft update without answers and result', () => {
      expectBadRequestCode(
        () =>
          parseChecklistAnswersDto({
            answers: [],
            version: 1,
          }),
        'CHECKLIST_UPDATE_EMPTY',
      );
    });

    it('allows draft result to be null', () => {
      expect(parseChecklistAnswersDto({ answers: [], result: null, version: 1 }))
        .toEqual({
          answers: [],
          result: null,
          version: 1,
        });
    });

    it('rejects unknown draft result', () => {
      expectBadRequestCode(
        () =>
          parseChecklistAnswersDto({
            answers: [],
            result: 'UNKNOWN',
            version: 1,
          }),
        'CHECKLIST_RESULT_INVALID',
      );
    });

    it('accepts a known draft result', () => {
      expect(
        parseChecklistAnswersDto({
          answers: [],
          result: ChecklistResult.FAILED,
          version: 1,
        }),
      ).toEqual({
        answers: [],
        result: ChecklistResult.FAILED,
        version: 1,
      });
    });

    it('allows result to be omitted when answers are updated', () => {
      expect(
        parseChecklistAnswersDto({
          answers: [
            {
              checklistDetailId: 1,
              value: true,
            },
          ],
          version: 1,
        }),
      ).toEqual({
        answers: [
          {
            checklistDetailId: 1,
            value: true,
          },
        ],
        result: undefined,
        version: 1,
      });
    });

    it('converts empty draft result to null', () => {
      expect(parseChecklistAnswersDto({ answers: [], result: '', version: 1 }))
        .toEqual({
          answers: [],
          result: null,
          version: 1,
        });
    });
  });
});
