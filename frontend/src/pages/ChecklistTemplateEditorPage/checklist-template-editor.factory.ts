import type {
  ChecklistQuestion,
  ChecklistTemplateDetail,
  ChecklistTemplateQuestion,
} from "../../shared/api/checklists";
import {
  normalizeModuleOrder,
  normalizeQuestionOrder,
} from "./checklist-template-editor.normalize";

export function createLocalTemplate(
  sourceTemplate: ChecklistTemplateDetail | null,
  getNextLocalId: () => number,
): ChecklistTemplateDetail {
  const now = new Date().toISOString();

  if (!sourceTemplate) {
    return {
      archivedAt: null,
      basedOnTemplateId: null,
      createdAt: now,
      description: null,
      id: 0,
      modules: [],
      name: "",
      publishedAt: null,
      state: "ACTIVE",
      updatedAt: now,
      version: 0,
    };
  }

  return {
    archivedAt: null,
    basedOnTemplateId: sourceTemplate.id,
    createdAt: now,
    description: sourceTemplate.description,
    id: 0,
    modules: normalizeModuleOrder(
      sourceTemplate.modules.map((module) => ({
        checklistModuleId: module.checklistModuleId,
        id: getNextLocalId(),
        name: module.name,
        questions: normalizeQuestionOrder(
          module.questions.map((question) => ({
            answerType: question.answerType,
            checklistQuestionId: question.checklistQuestionId,
            id: getNextLocalId(),
            isRequired: question.isRequired,
            questionText: question.questionText,
            sortOrder: question.sortOrder,
          })),
        ),
        sortOrder: module.sortOrder,
      })),
    ),
    name: `${sourceTemplate.name} (копия)`,
    publishedAt: null,
    state: "ACTIVE",
    updatedAt: now,
    version: 0,
  };
}

export function createLocalTemplateQuestion(
  question: ChecklistQuestion,
  sortOrder: number,
  getNextLocalId: () => number,
): ChecklistTemplateQuestion {
  return {
    answerType: question.answerType,
    checklistQuestionId: question.id,
    id: getNextLocalId(),
    isRequired: true,
    questionText: question.questionText,
    sortOrder,
  };
}
