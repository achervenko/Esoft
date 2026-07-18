import type { ChecklistModule, ChecklistQuestion } from "../../shared/api/checklists";

export function sortByOrder<T extends { id: number; sortOrder: number }>(
  left: T,
  right: T,
) {
  return left.sortOrder - right.sortOrder || left.id - right.id;
}

export function sortQuestionByOrder(
  left: ChecklistQuestion,
  right: ChecklistQuestion,
) {
  return (left.sortOrder ?? 0) - (right.sortOrder ?? 0) || left.id - right.id;
}

export function sortUnassignedQuestions(
  left: ChecklistQuestion,
  right: ChecklistQuestion,
) {
  return (
    new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime() ||
    right.id - left.id
  );
}

export function sortModulesForCatalog(
  left: ChecklistModule,
  right: ChecklistModule,
) {
  return (
    Number(right.isActive) - Number(left.isActive) ||
    left.sortOrder - right.sortOrder ||
    left.name.localeCompare(right.name, "ru") ||
    left.id - right.id
  );
}

export function sortQuestionsForCatalog(
  left: ChecklistQuestion,
  right: ChecklistQuestion,
) {
  return (
    (left.checklistModuleId ?? 0) - (right.checklistModuleId ?? 0) ||
    (left.sortOrder ?? 0) - (right.sortOrder ?? 0) ||
    left.id - right.id
  );
}

export function moveById<T extends { id: number }>(
  items: T[],
  sourceId: number,
  targetIndex: number,
) {
  const sourceIndex = items.findIndex((item) => item.id === sourceId);

  if (sourceIndex === -1) {
    return items;
  }

  const nextItems = [...items];
  const [movedItem] = nextItems.splice(sourceIndex, 1);
  const adjustedTargetIndex =
    targetIndex > sourceIndex ? targetIndex - 1 : targetIndex;
  const normalizedTargetIndex = Math.max(
    0,
    Math.min(adjustedTargetIndex, nextItems.length),
  );
  nextItems.splice(normalizedTargetIndex, 0, movedItem);

  return nextItems;
}

export function normalizeModuleOrder<T extends ChecklistModule>(items: T[]) {
  return items.map((item, index) => ({ ...item, sortOrder: index + 1 }));
}

export function normalizeQuestionOrder<T extends ChecklistQuestion>(items: T[]) {
  return items.map((item, index) => ({ ...item, sortOrder: index + 1 }));
}

export function areSameOrder<T extends { id: number }>(left: T[], right: T[]) {
  return (
    left.length === right.length &&
    left.every((item, index) => item.id === right[index]?.id)
  );
}

export function toReorderItems<T extends { id: number }>(items: T[]) {
  return items.map((item, index) => ({ id: item.id, sortOrder: index + 1 }));
}

export function applyModuleSortOrder(
  modules: ChecklistModule[],
  orderedModules: Array<{ id: number; sortOrder: number }>,
) {
  const sortOrderById = new Map(
    orderedModules.map((module) => [module.id, module.sortOrder]),
  );

  return modules
    .map((module) => {
      const sortOrder = sortOrderById.get(module.id);

      return sortOrder === undefined ? module : { ...module, sortOrder };
    })
    .sort(sortModulesForCatalog);
}

export function applyQuestionSortOrder(
  allQuestions: ChecklistQuestion[],
  moduleId: number,
  orderedQuestions: Array<{ id: number; sortOrder: number }>,
) {
  const sortOrderById = new Map(
    orderedQuestions.map((question) => [question.id, question.sortOrder]),
  );

  return allQuestions
    .map((question) => {
      if (question.checklistModuleId !== moduleId) {
        return question;
      }

      const sortOrder = sortOrderById.get(question.id);

      return sortOrder === undefined ? question : { ...question, sortOrder };
    })
    .sort(sortQuestionsForCatalog);
}
