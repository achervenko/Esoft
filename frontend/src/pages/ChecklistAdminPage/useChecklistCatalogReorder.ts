import { useCallback, useRef, useState } from "react";
import {
  getChecklistAdminErrorMessage,
  reorderChecklistModules,
  reorderChecklistQuestions,
} from "../../shared/api/checklists";
import {
  applyModuleSortOrder,
  applyQuestionSortOrder,
  areSameOrder,
  moveById,
  normalizeModuleOrder,
  normalizeQuestionOrder,
  sortQuestionByOrder,
  toReorderItems,
} from "./checklist-catalog.order";
import type { ChecklistCatalogReorderState } from "./checklist-catalog.types";
import type { useChecklistCatalogSelection } from "./useChecklistCatalogSelection";

type ChecklistCatalogSelection = ReturnType<typeof useChecklistCatalogSelection>;

export function useChecklistCatalogReorder({
  selection,
  state,
}: {
  selection: ChecklistCatalogSelection;
  state: ChecklistCatalogReorderState;
}) {
  const { activeModules, selectedActiveQuestions } = selection;
  const {
    questionSearch,
    selectedGroup,
    setError,
    setModules,
    setQuestions,
  } = state;
  const [isSavingModules, setIsSavingModules] = useState(false);
  const [isSavingQuestions, setIsSavingQuestions] = useState(false);
  const isSavingModulesRef = useRef(false);
  const isSavingQuestionsRef = useRef(false);

  const reorderModules = useCallback(
    async (sourceId: number, targetIndex: number) => {
      if (isSavingModulesRef.current) {
        return;
      }

      const nextActiveModules = normalizeModuleOrder(
        moveById(activeModules, sourceId, targetIndex),
      );

      if (areSameOrder(activeModules, nextActiveModules)) {
        return;
      }

      const previousModuleOrder = toReorderItems(activeModules);
      isSavingModulesRef.current = true;
      setModules((currentModules) =>
        applyModuleSortOrder(currentModules, nextActiveModules),
      );
      setIsSavingModules(true);
      setError(null);

      try {
        const response = await reorderChecklistModules(
          toReorderItems(nextActiveModules),
        );
        setModules((currentModules) =>
          applyModuleSortOrder(currentModules, response.modules),
        );
      } catch (requestError) {
        setModules((currentModules) =>
          applyModuleSortOrder(currentModules, previousModuleOrder),
        );
        setError(getChecklistAdminErrorMessage(requestError));
      } finally {
        isSavingModulesRef.current = false;
        setIsSavingModules(false);
      }
    },
    [activeModules, setError, setModules],
  );

  const reorderQuestions = useCallback(
    async (sourceId: number, targetIndex: number) => {
      if (
        isSavingQuestionsRef.current ||
        selectedGroup.kind !== "module" ||
        questionSearch.trim()
      ) {
        return;
      }

      const nextQuestions = normalizeQuestionOrder(
        moveById(selectedActiveQuestions, sourceId, targetIndex),
      );

      if (areSameOrder(selectedActiveQuestions, nextQuestions)) {
        return;
      }

      const moduleId = selectedGroup.moduleId;
      const previousQuestionOrder = toReorderItems(selectedActiveQuestions);
      isSavingQuestionsRef.current = true;
      setQuestions((currentQuestions) =>
        applyQuestionSortOrder(currentQuestions, moduleId, nextQuestions),
      );
      setIsSavingQuestions(true);
      setError(null);

      try {
        const response = await reorderChecklistQuestions(
          moduleId,
          toReorderItems(nextQuestions),
        );
        setQuestions((currentQuestions) =>
          applyQuestionSortOrder(
            currentQuestions,
            moduleId,
            toReorderItems(response.questions.sort(sortQuestionByOrder)),
          ),
        );
      } catch (requestError) {
        setQuestions((currentQuestions) =>
          applyQuestionSortOrder(currentQuestions, moduleId, previousQuestionOrder),
        );
        setError(getChecklistAdminErrorMessage(requestError));
      } finally {
        isSavingQuestionsRef.current = false;
        setIsSavingQuestions(false);
      }
    },
    [
      questionSearch,
      selectedActiveQuestions,
      selectedGroup,
      setError,
      setQuestions,
    ],
  );

  return {
    isSavingModules,
    isSavingQuestions,
    reorderModules,
    reorderQuestions,
  };
}
