import type { ChecklistTemplateModule } from "../../shared/api/checklists";
import type { useChecklistTemplateEditor } from "./useChecklistTemplateEditor";

type EditorState = ReturnType<typeof useChecklistTemplateEditor>;

export function getSelectedModule(
  modules: EditorState["modules"],
  addModuleId: number | null,
) {
  return addModuleId
    ? modules.find((module) => module.id === addModuleId) ?? null
    : null;
}

export function getAddQuestionModule(
  template: EditorState["template"],
  addQuestionModuleId: number | null,
) {
  return addQuestionModuleId
    ? template?.modules.find((module) => module.id === addQuestionModuleId) ??
        null
    : null;
}

export function getAvailableQuestions(
  questions: EditorState["questions"],
  module: ChecklistTemplateModule,
) {
  return questions.filter(
    (question) =>
      question.checklistModuleId === module.checklistModuleId &&
      !module.questions.some((item) => item.checklistQuestionId === question.id),
  );
}
