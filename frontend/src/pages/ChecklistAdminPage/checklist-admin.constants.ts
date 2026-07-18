import {
  checklistAnswerTypeLabels,
  checklistTemplateStateLabels,
} from "../../shared/api/checklists";
import type { ActiveChecklistAdminTab } from "./checklist-admin.types";

export const checklistAdminTabLabels: Record<ActiveChecklistAdminTab, string> = {
  templates: "Шаблоны",
  catalog: "Модули и вопросы",
};

export const answerTypeOptions = Object.entries(checklistAnswerTypeLabels).map(
  ([value, label]) => ({ label, value }),
);

export const templateStateOptions = [
  { label: checklistTemplateStateLabels.ACTIVE, value: "ACTIVE" },
  { label: checklistTemplateStateLabels.ARCHIVED, value: "ARCHIVED" },
];

export const activeStateOptions = [
  { label: "Все статусы", value: "" },
  { label: "Активен", value: "true" },
  { label: "Неактивен", value: "false" },
];
