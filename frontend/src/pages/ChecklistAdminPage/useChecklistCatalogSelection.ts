import { useMemo } from "react";
import {
  getActiveGroupQuestions,
  getActiveModules,
  getGroupQuestions,
  getQuestionCountByModuleId,
  getSelectedModule,
  getUnassignedQuestions,
} from "./checklist-catalog.selectors";
import type { ChecklistCatalogSelectionState } from "./checklist-catalog.types";

export function useChecklistCatalogSelection({
  modules,
  questionSearch,
  questions,
  selectedGroup,
}: ChecklistCatalogSelectionState) {
  const activeModules = useMemo(() => getActiveModules(modules), [modules]);

  const selectedModule = useMemo(
    () => getSelectedModule(modules, selectedGroup),
    [modules, selectedGroup],
  );

  const unassignedQuestions = useMemo(
    () => getUnassignedQuestions(questions),
    [questions],
  );

  const groupQuestions = useMemo(
    () => getGroupQuestions(questions, selectedGroup, questionSearch),
    [questionSearch, questions, selectedGroup],
  );

  const selectedActiveQuestions = useMemo(
    () => getActiveGroupQuestions(questions, selectedGroup),
    [questions, selectedGroup],
  );

  const questionCountByModuleId = useMemo(
    () => getQuestionCountByModuleId(questions),
    [questions],
  );

  return {
    activeModules,
    groupQuestions,
    questionCountByModuleId,
    selectedActiveQuestions,
    selectedModule,
    unassignedCount: unassignedQuestions.length,
    unassignedQuestions,
  };
}
