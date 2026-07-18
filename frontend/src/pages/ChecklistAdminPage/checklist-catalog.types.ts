import type { Dispatch, SetStateAction } from "react";
import type { ChecklistModule, ChecklistQuestion } from "../../shared/api/checklists";

export type SelectedQuestionGroup =
  | { kind: "module"; moduleId: number }
  | { kind: "unassigned" };

export type ChecklistCatalogSelectionState = {
  modules: ChecklistModule[];
  questionSearch: string;
  questions: ChecklistQuestion[];
  selectedGroup: SelectedQuestionGroup;
};

export type ChecklistCatalogLoaderState = {
  setError: Dispatch<SetStateAction<string | null>>;
  setIsLoading: Dispatch<SetStateAction<boolean>>;
  setIsRefreshing: Dispatch<SetStateAction<boolean>>;
  setModules: Dispatch<SetStateAction<ChecklistModule[]>>;
  setQuestions: Dispatch<SetStateAction<ChecklistQuestion[]>>;
  setSelectedGroup: Dispatch<SetStateAction<SelectedQuestionGroup>>;
};

export type ChecklistCatalogMutationState = {
  pendingModuleIds: Set<number>;
  pendingQuestionIds: Set<number>;
  setError: Dispatch<SetStateAction<string | null>>;
  setModules: Dispatch<SetStateAction<ChecklistModule[]>>;
  setPendingModuleIds: Dispatch<SetStateAction<Set<number>>>;
  setPendingQuestionIds: Dispatch<SetStateAction<Set<number>>>;
  setQuestions: Dispatch<SetStateAction<ChecklistQuestion[]>>;
  setSelectedGroup: Dispatch<SetStateAction<SelectedQuestionGroup>>;
};

export type ChecklistCatalogReorderState = {
  modules: ChecklistModule[];
  questionSearch: string;
  questions: ChecklistQuestion[];
  selectedGroup: SelectedQuestionGroup;
  setError: Dispatch<SetStateAction<string | null>>;
  setModules: Dispatch<SetStateAction<ChecklistModule[]>>;
  setQuestions: Dispatch<SetStateAction<ChecklistQuestion[]>>;
};
