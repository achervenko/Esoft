import type {
  ChecklistTemplateModule,
  ChecklistTemplateQuestion,
} from "../../shared/api/checklists";

export function normalizeModuleOrder(
  modules: ChecklistTemplateModule[],
): ChecklistTemplateModule[] {
  return modules.map((module, index) => ({
    ...module,
    questions: normalizeQuestionOrder(module.questions),
    sortOrder: index + 1,
  }));
}

export function normalizeQuestionOrder(
  questions: ChecklistTemplateQuestion[],
): ChecklistTemplateQuestion[] {
  return questions.map((question, index) => ({
    ...question,
    sortOrder: index + 1,
  }));
}

export function areSameIds(left: number[], right: number[]) {
  return left.length === right.length && left.every((id, index) => id === right[index]);
}

export function moveItemToIndex<T>(items: T[], sourceIndex: number, targetIndex: number) {
  if (
    sourceIndex < 0 ||
    sourceIndex >= items.length ||
    targetIndex < 0 ||
    targetIndex >= items.length ||
    sourceIndex === targetIndex
  ) {
    return items;
  }

  const nextItems = [...items];
  const [item] = nextItems.splice(sourceIndex, 1);
  nextItems.splice(targetIndex, 0, item);
  return nextItems;
}
