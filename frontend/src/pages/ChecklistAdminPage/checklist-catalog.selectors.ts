import type { ChecklistModule, ChecklistQuestion } from "../../shared/api/checklists";
import {
  sortByOrder,
  sortQuestionByOrder,
  sortUnassignedQuestions,
} from "./checklist-catalog.order";
import type { SelectedQuestionGroup } from "./checklist-catalog.types";

export function getActiveModules(modules: ChecklistModule[]) {
  return modules.filter((module) => module.isActive).sort(sortByOrder);
}

export function getSelectedModule(
  modules: ChecklistModule[],
  selectedGroup: SelectedQuestionGroup,
) {
  return selectedGroup.kind === "module"
    ? modules.find((module) => module.id === selectedGroup.moduleId) ?? null
    : null;
}

export function getUnassignedQuestions(questions: ChecklistQuestion[]) {
  return questions
    .filter((question) => question.checklistModuleId === null)
    .sort(sortUnassignedQuestions);
}

export function getGroupQuestions(
  questions: ChecklistQuestion[],
  selectedGroup: SelectedQuestionGroup,
  questionSearch: string,
) {
  const sourceQuestions =
    selectedGroup.kind === "unassigned"
      ? getUnassignedQuestions(questions)
      : questions
          .filter((question) => question.checklistModuleId === selectedGroup.moduleId)
          .sort(sortQuestionByOrder);
  const search = questionSearch.trim().toLocaleLowerCase("ru-RU");

  if (!search) {
    return sourceQuestions;
  }

  return sourceQuestions.filter((question) =>
    question.questionText.toLocaleLowerCase("ru-RU").includes(search),
  );
}

export function getActiveGroupQuestions(
  questions: ChecklistQuestion[],
  selectedGroup: SelectedQuestionGroup,
) {
  return selectedGroup.kind === "module"
    ? questions
        .filter(
          (question) =>
            question.checklistModuleId === selectedGroup.moduleId &&
            question.isActive,
        )
        .sort(sortQuestionByOrder)
    : [];
}

export function getQuestionCountByModuleId(questions: ChecklistQuestion[]) {
  const counts = new Map<number, number>();

  questions.forEach((question) => {
    if (question.checklistModuleId === null) {
      return;
    }

    counts.set(
      question.checklistModuleId,
      (counts.get(question.checklistModuleId) ?? 0) + 1,
    );
  });

  return counts;
}
