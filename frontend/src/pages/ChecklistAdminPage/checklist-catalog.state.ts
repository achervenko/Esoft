import { useState } from "react";
import type { ChecklistModule, ChecklistQuestion } from "../../shared/api/checklists";
import type { SelectedQuestionGroup } from "./checklist-catalog.types";

export function useChecklistCatalogState() {
  const [modules, setModules] = useState<ChecklistModule[]>([]);
  const [questions, setQuestions] = useState<ChecklistQuestion[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<SelectedQuestionGroup>({
    kind: "unassigned",
  });
  const [questionSearch, setQuestionSearch] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pendingModuleIds, setPendingModuleIds] = useState<Set<number>>(
    () => new Set(),
  );
  const [pendingQuestionIds, setPendingQuestionIds] = useState<Set<number>>(
    () => new Set(),
  );
  const [error, setError] = useState<string | null>(null);

  return {
    error,
    isLoading,
    isRefreshing,
    modules,
    pendingModuleIds,
    pendingQuestionIds,
    questionSearch,
    questions,
    selectedGroup,
    setError,
    setIsLoading,
    setIsRefreshing,
    setModules,
    setPendingModuleIds,
    setPendingQuestionIds,
    setQuestionSearch,
    setQuestions,
    setSelectedGroup,
  };
}
