import { Prisma } from '@prisma/client';
import type {
  parseChecklistQuestionPayload,
  parseChecklistQuestionReorderPayload,
  parseChecklistQuestionUpdatePayload,
  parseChecklistQuestionsQuery,
} from './checklist-questions.validation';
import { checklistQuestionInclude } from './checklist-questions.select';

export type QuestionInput = ReturnType<typeof parseChecklistQuestionPayload>;
export type QuestionUpdateInput = ReturnType<
  typeof parseChecklistQuestionUpdatePayload
>;
export type QuestionQuery = ReturnType<typeof parseChecklistQuestionsQuery>;
export type QuestionReorderInput = ReturnType<
  typeof parseChecklistQuestionReorderPayload
>;
export type ChecklistQuestionRecord = Prisma.ChecklistQuestionGetPayload<{
  include: typeof checklistQuestionInclude;
}>;
