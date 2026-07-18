export type ChecklistAnswerType = "BOOLEAN" | "INTEGER" | "DECIMAL" | "TEXT" | "DATE";

export type ChecklistTemplateState = "ACTIVE" | "ARCHIVED";

export type ChecklistPageResponse<T> = {
  items: T[];
  limit: number;
  page: number;
  total: number;
};

export type ChecklistModule = {
  createdAt: string;
  description: string | null;
  id: number;
  isActive: boolean;
  name: string;
  sortOrder: number;
  updatedAt: string;
};

export type ChecklistQuestion = {
  answerType: ChecklistAnswerType;
  checklistModuleId: number | null;
  createdAt: string;
  id: number;
  isActive: boolean;
  module: {
    id: number;
    isActive: boolean;
    name: string;
  } | null;
  questionText: string;
  sortOrder: number | null;
  updatedAt: string;
};

export type ChecklistTemplateListItem = {
  archivedAt: string | null;
  createdAt: string;
  id: number;
  moduleCount: number;
  name: string;
  publishedAt: string | null;
  questionCount: number;
  state: ChecklistTemplateState;
  updatedAt: string;
  version: number;
};

export type ChecklistTemplateQuestion = {
  answerType: ChecklistAnswerType;
  checklistQuestionId: number;
  id: number;
  isRequired: boolean;
  questionText: string;
  sortOrder: number;
};

export type ChecklistTemplateModule = {
  checklistModuleId: number;
  id: number;
  name: string;
  questions: ChecklistTemplateQuestion[];
  sortOrder: number;
};

export type ChecklistTemplateDetail = {
  archivedAt: string | null;
  basedOnTemplateId: number | null;
  createdAt: string;
  description: string | null;
  id: number;
  modules: ChecklistTemplateModule[];
  name: string;
  publishedAt: string | null;
  state: ChecklistTemplateState;
  updatedAt: string;
  version: number;
};

export type ChecklistModulePayload = {
  description?: string | null;
  name: string;
};

export type ChecklistQuestionPayload = {
  answerType: ChecklistAnswerType;
  checklistModuleId: number | null;
  questionText: string;
};

export type ChecklistTemplatePayload = {
  description?: string | null;
  modules: {
    checklistModuleId: number;
    questions: {
      checklistQuestionId: number;
      isRequired: boolean;
      sortOrder: number;
    }[];
    sortOrder: number;
  }[];
  name: string;
};

export type ChecklistReorderItem = {
  id: number;
  sortOrder: number;
};

export const checklistAnswerTypeLabels: Record<ChecklistAnswerType, string> = {
  BOOLEAN: "Да / Нет",
  DATE: "Дата",
  DECIMAL: "Десятичное число",
  INTEGER: "Целое число",
  TEXT: "Текст",
};

export const checklistTemplateStateLabels: Record<ChecklistTemplateState, string> = {
  ACTIVE: "Действующий",
  ARCHIVED: "Удалённый",
};
