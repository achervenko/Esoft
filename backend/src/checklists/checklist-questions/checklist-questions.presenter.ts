import type { ChecklistQuestionRecord } from './checklist-questions.types';

export function presentQuestion(question: ChecklistQuestionRecord) {
  return {
    answerType: question.answerType,
    checklistModuleId: question.checklistModuleId,
    createdAt: question.createdAt,
    id: question.id,
    isActive: question.isActive,
    module: question.module,
    questionText: question.questionText,
    sortOrder: question.sortOrder,
    updatedAt: question.updatedAt,
  };
}
