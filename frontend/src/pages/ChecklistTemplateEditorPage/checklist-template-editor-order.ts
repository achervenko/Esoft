import type { ChecklistQuestion } from "../../shared/api/checklists";

export function sortCatalogQuestions(
  left: ChecklistQuestion,
  right: ChecklistQuestion,
) {
  return (
    (left.sortOrder ?? Number.MAX_SAFE_INTEGER) -
      (right.sortOrder ?? Number.MAX_SAFE_INTEGER) ||
    left.id - right.id
  );
}

export function getCatalogQuestionOrder(
  questions: ChecklistQuestion[],
  checklistQuestionId: number,
) {
  return (
    questions.find((question) => question.id === checklistQuestionId)
      ?.sortOrder ?? Number.MAX_SAFE_INTEGER
  );
}

export function clampIndex(index: number, length: number) {
  return Math.min(Math.max(index, 0), length);
}
