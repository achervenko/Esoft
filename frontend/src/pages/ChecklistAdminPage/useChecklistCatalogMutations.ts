import { useCallback, useEffect, useRef } from "react";
import {
  activateChecklistModule,
  activateChecklistQuestion,
  createChecklistModule,
  createChecklistQuestion,
  deactivateChecklistModule,
  deactivateChecklistQuestion,
  getChecklistAdminErrorMessage,
  type ChecklistModule,
  type ChecklistModulePayload,
  type ChecklistQuestion,
  type ChecklistQuestionPayload,
  updateChecklistModule,
  updateChecklistQuestion,
} from "../../shared/api/checklists";
import type { ChecklistCatalogMutationState } from "./checklist-catalog.types";
import {
  updateQuestionModuleSummaries,
  upsertModule,
  upsertQuestion,
} from "./checklist-catalog.utils";

export function useChecklistCatalogMutations({
  state,
}: {
  state: ChecklistCatalogMutationState;
}) {
  const {
    pendingModuleIds,
    pendingQuestionIds,
    setError,
    setModules,
    setPendingModuleIds,
    setPendingQuestionIds,
    setQuestions,
    setSelectedGroup,
  } = state;
  const pendingModuleIdsRef = useRef(pendingModuleIds);
  const pendingQuestionIdsRef = useRef(pendingQuestionIds);

  useEffect(() => {
    pendingModuleIdsRef.current = pendingModuleIds;
  }, [pendingModuleIds]);

  useEffect(() => {
    pendingQuestionIdsRef.current = pendingQuestionIds;
  }, [pendingQuestionIds]);

  const selectCreatedModule = useCallback(
    (module: ChecklistModule) => {
      setSelectedGroup({ kind: "module", moduleId: module.id });
    },
    [setSelectedGroup],
  );

  const saveModule = useCallback(
    async (item: ChecklistModule | null, payload: ChecklistModulePayload) => {
      setError(null);

      try {
        const response = item
          ? await updateChecklistModule(item.id, payload)
          : await createChecklistModule(payload);

        setModules((currentModules) =>
          upsertModule(currentModules, response.module),
        );
        setQuestions((currentQuestions) =>
          updateQuestionModuleSummaries(currentQuestions, response.module),
        );

        if (!item) {
          selectCreatedModule(response.module);
        }
      } catch (requestError) {
        setError(getChecklistAdminErrorMessage(requestError));
        throw requestError;
      }
    },
    [selectCreatedModule, setError, setModules, setQuestions],
  );

  const saveQuestion = useCallback(
    async (item: ChecklistQuestion | null, payload: ChecklistQuestionPayload) => {
      setError(null);

      try {
        const response = item
          ? await updateChecklistQuestion(item.id, payload)
          : await createChecklistQuestion(payload);

        setQuestions((currentQuestions) =>
          upsertQuestion(currentQuestions, response.question),
        );
      } catch (requestError) {
        setError(getChecklistAdminErrorMessage(requestError));
        throw requestError;
      }
    },
    [setError, setQuestions],
  );

  const setModuleStatus = useCallback(
    async (module: ChecklistModule, isActive: boolean) => {
      if (pendingModuleIdsRef.current.has(module.id)) {
        return;
      }

      pendingModuleIdsRef.current = new Set(pendingModuleIdsRef.current).add(
        module.id,
      );
      setPendingModuleIds((currentIds) => {
        const nextIds = new Set(currentIds);
        nextIds.add(module.id);
        return nextIds;
      });
      setError(null);

      try {
        const response = isActive
          ? await activateChecklistModule(module.id)
          : await deactivateChecklistModule(module.id);

        setModules((currentModules) =>
          upsertModule(currentModules, response.module),
        );
        setQuestions((currentQuestions) => {
          const questionsWithUpdatedModule = updateQuestionModuleSummaries(
            currentQuestions,
            response.module,
          );

          if (isActive) {
            return questionsWithUpdatedModule;
          }

          return questionsWithUpdatedModule.map((question) =>
            question.checklistModuleId === module.id && question.isActive
              ? { ...question, isActive: false }
              : question,
          );
        });
      } catch (requestError) {
        setError(getChecklistAdminErrorMessage(requestError));
        throw requestError;
      } finally {
        const nextPendingIds = new Set(pendingModuleIdsRef.current);
        nextPendingIds.delete(module.id);
        pendingModuleIdsRef.current = nextPendingIds;
        setPendingModuleIds((currentIds) => {
          const nextIds = new Set(currentIds);
          nextIds.delete(module.id);
          return nextIds;
        });
      }
    },
    [setError, setModules, setPendingModuleIds, setQuestions],
  );

  const setQuestionStatus = useCallback(
    async (question: ChecklistQuestion, isActive: boolean) => {
      if (pendingQuestionIdsRef.current.has(question.id)) {
        return;
      }

      pendingQuestionIdsRef.current = new Set(pendingQuestionIdsRef.current).add(
        question.id,
      );
      setPendingQuestionIds((currentIds) => {
        const nextIds = new Set(currentIds);
        nextIds.add(question.id);
        return nextIds;
      });
      setError(null);

      try {
        const response = isActive
          ? await activateChecklistQuestion(question.id)
          : await deactivateChecklistQuestion(question.id);

        setQuestions((currentQuestions) =>
          upsertQuestion(currentQuestions, response.question),
        );
      } catch (requestError) {
        setError(getChecklistAdminErrorMessage(requestError));
        throw requestError;
      } finally {
        const nextPendingIds = new Set(pendingQuestionIdsRef.current);
        nextPendingIds.delete(question.id);
        pendingQuestionIdsRef.current = nextPendingIds;
        setPendingQuestionIds((currentIds) => {
          const nextIds = new Set(currentIds);
          nextIds.delete(question.id);
          return nextIds;
        });
      }
    },
    [setError, setPendingQuestionIds, setQuestions],
  );

  return {
    saveModule,
    saveQuestion,
    selectCreatedModule,
    setModuleStatus,
    setQuestionStatus,
  };
}
