import { useCallback, useState } from "react";
import {
  archiveChecklistTemplate,
  getChecklistAdminErrorMessage,
  type ChecklistModule,
  type ChecklistModulePayload,
  type ChecklistQuestion,
  type ChecklistQuestionPayload,
} from "../../shared/api/checklists";
import type {
  ActiveChecklistAdminTab,
  ChecklistAdminConfirmState,
} from "./checklist-admin.types";
import type { useChecklistCatalog } from "./useChecklistCatalog";

type ChecklistAdminActionsOptions = {
  activeTab: ActiveChecklistAdminTab;
  catalogState: ReturnType<typeof useChecklistCatalog>;
  reloadCatalog: () => Promise<void>;
  reloadTemplates: () => Promise<void>;
};

export function useChecklistAdminActions({
  activeTab,
  catalogState,
  reloadCatalog,
  reloadTemplates,
}: ChecklistAdminActionsOptions) {
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const refreshActiveTab = useCallback(async () => {
    if (activeTab === "templates") {
      await reloadTemplates();
      return;
    }

    await reloadCatalog();
  }, [activeTab, reloadCatalog, reloadTemplates]);

  const runAction = useCallback(
    async (
      action: () => Promise<void>,
      options: { shouldRefresh?: boolean } = {},
    ) => {
      setIsSaving(true);
      setActionError(null);
      setMessage(null);

      try {
        await action();
        if (options.shouldRefresh ?? true) {
          try {
            await refreshActiveTab();
          } catch (refreshError) {
            setActionError(
              `Действие выполнено, но не удалось обновить список: ${getChecklistAdminErrorMessage(refreshError)}`,
            );
          }
        }
      } catch (requestError) {
        setMessage(null);
        setActionError(getChecklistAdminErrorMessage(requestError));
      } finally {
        setIsSaving(false);
      }
    },
    [refreshActiveTab],
  );

  const clearFeedback = useCallback(() => {
    setActionError(null);
    setMessage(null);
  }, []);

  const activateModule = useCallback(
    (module: ChecklistModule) =>
      runAction(async () => {
        await catalogState.setModuleStatus(module, true);
      }, { shouldRefresh: false }),
    [catalogState, runAction],
  );

  const saveModule = useCallback(
    (
      item: ChecklistModule | null,
      payload: ChecklistModulePayload,
      onDone: () => void,
    ) =>
      runAction(async () => {
        await catalogState.saveModule(item, payload);
        onDone();
      }, { shouldRefresh: false }),
    [catalogState, runAction],
  );

  const saveQuestion = useCallback(
    (
      item: ChecklistQuestion | null,
      payload: ChecklistQuestionPayload,
      onDone: () => void,
    ) =>
      runAction(async () => {
        await catalogState.saveQuestion(item, payload);
        onDone();
      }, { shouldRefresh: false }),
    [catalogState, runAction],
  );

  const activateQuestion = useCallback(
    (question: ChecklistQuestion) =>
      runAction(async () => {
        await catalogState.setQuestionStatus(question, true);
      }, { shouldRefresh: false }),
    [catalogState, runAction],
  );

  const runConfirmAction = useCallback(
    (
      state: NonNullable<ChecklistAdminConfirmState>,
      onDone: () => void,
    ) =>
      runAction(async () => {
        if (state.kind === "module-status") {
          if (state.module.isActive) {
            await catalogState.setModuleStatus(state.module, false);
          } else {
            await catalogState.setModuleStatus(state.module, true);
          }
        }

        if (state.kind === "question-status") {
          if (state.question.isActive) {
            await catalogState.setQuestionStatus(state.question, false);
          } else {
            await catalogState.setQuestionStatus(state.question, true);
          }
        }

        if (state.kind === "archive-template") {
          await archiveChecklistTemplate(
            state.template.id,
            state.template.version,
          );
          setMessage("Шаблон удалён.");
        }

        onDone();
      }, { shouldRefresh: state.kind === "archive-template" }),
    [catalogState, runAction],
  );

  return {
    actionError,
    isSaving,
    message,
    activateModule,
    activateQuestion,
    clearFeedback,
    runConfirmAction,
    saveModule,
    saveQuestion,
  };
}
