import type { ChecklistTemplateDetail } from "../../shared/api/checklists";

export type TemplateEditorConfirmState = "exit" | null;

export function getTemplateConfirmDescription() {
  return "Все внесённые данные шаблона будут потеряны.";
}

export function getTemplateConfirmTitle() {
  return "Выйти без сохранения?";
}

export function getTemplateConfirmLabel() {
  return "Выйти";
}

export function getModuleQuestionsCount(
  template: ChecklistTemplateDetail,
  checklistModuleId: number,
) {
  return template.modules.find(
    (module) => module.checklistModuleId === checklistModuleId,
  )?.questions.length ?? 0;
}
