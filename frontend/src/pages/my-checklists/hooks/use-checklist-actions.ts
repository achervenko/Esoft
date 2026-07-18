import { useCallback, useState } from "react";
import { getApiErrorMessage } from "../../../shared/api/api-error";
import {
  completeChecklistWork,
  getChecklistWorkDetail,
  saveChecklistWorkAnswers,
  startChecklistWork,
  type ChecklistWorkAnswerPayload,
  type ChecklistWorkDetail,
  type ChecklistWorkListItem,
} from "../../../shared/api/checklists";
import { mapChecklistActionError } from "../my-checklists.errors";

type UseChecklistActionsParams = {
  changedAnswers: ChecklistWorkAnswerPayload[];
  hasUnsavedChanges: boolean;
  onChecklistStarted?: (checklist: ChecklistWorkDetail) => void;
  onSelectChecklistId: (checklistId: number | null) => void;
  reloadItems: () => Promise<ChecklistWorkListItem[] | null>;
  selectedChecklist: ChecklistWorkDetail | null;
  setDetailError: (error: string | null) => void;
  setSelectedChecklist: (checklist: ChecklistWorkDetail | null) => void;
  setVersionConflict: (error: string | null) => void;
  validateRequiredDraftAnswers: () => string | null;
};

export function useChecklistActions({
  changedAnswers,
  hasUnsavedChanges,
  onChecklistStarted,
  onSelectChecklistId,
  reloadItems,
  selectedChecklist,
  setDetailError,
  setSelectedChecklist,
  setVersionConflict,
  validateRequiredDraftAnswers,
}: UseChecklistActionsParams) {
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [refreshError, setRefreshError] = useState<string | null>(null);

  const applyMutationError = useCallback(
    (error: unknown, target: "detail" | "form") => {
      const result = mapChecklistActionError(error, target);

      setDetailError(result.detailError);
      setFormError(result.formError);
      setVersionConflict(result.versionConflict);
    },
    [setDetailError, setVersionConflict],
  );

  const clearActionState = useCallback(() => {
    setDetailError(null);
    setFormError(null);
    setVersionConflict(null);
    setMessage(null);
    setRefreshError(null);
  }, [setDetailError, setVersionConflict]);

  const handleRefreshError = useCallback((error: unknown, fallbackMessage: string) => {
    setRefreshError(getApiErrorMessage(error) || fallbackMessage);
  }, []);

  const startFromListItem = useCallback(
    async (item: ChecklistWorkListItem) => {
      setIsActionLoading(true);
      clearActionState();

      try {
        const detail = await startChecklistWork(item.id, { version: item.version });
        onSelectChecklistId(detail.id);
        setSelectedChecklist(detail);
        onChecklistStarted?.(detail);
        setMessage("Чек-лист переведён в работу.");
      } catch (requestError) {
        applyMutationError(requestError, "detail");
      } finally {
        setIsActionLoading(false);
      }
    },
    [
      applyMutationError,
      clearActionState,
      onChecklistStarted,
      onSelectChecklistId,
      setSelectedChecklist,
    ],
  );

  const startSelectedChecklist = useCallback(async () => {
    if (!selectedChecklist) {
      return;
    }

    await startFromListItem(selectedChecklist);
  }, [selectedChecklist, startFromListItem]);

  const saveChecklist = useCallback(async () => {
    if (!selectedChecklist) {
      return null;
    }

    if (changedAnswers.length === 0) {
      setMessage("Изменений для сохранения нет.");
      return selectedChecklist;
    }

    setIsActionLoading(true);
    setFormError(null);
    setVersionConflict(null);
    setMessage(null);
    setRefreshError(null);

    try {
      await saveChecklistWorkAnswers(selectedChecklist.id, {
        answers: changedAnswers,
        version: selectedChecklist.version,
      });
      setMessage("Ответы сохранены.");

      try {
        const nextDetail = await getChecklistWorkDetail(selectedChecklist.id);
        setSelectedChecklist(nextDetail);

        try {
          await reloadItems();
        } catch (requestError) {
          handleRefreshError(
            requestError,
            "Ответы сохранены, но список чек-листов не удалось обновить.",
          );
        }

        return nextDetail;
      } catch (requestError) {
        handleRefreshError(
          requestError,
          "Ответы сохранены, но данные чек-листа не удалось обновить.",
        );
        return null;
      }
    } catch (requestError) {
      applyMutationError(requestError, "form");
      return null;
    } finally {
      setIsActionLoading(false);
    }
  }, [
    applyMutationError,
    changedAnswers,
    handleRefreshError,
    reloadItems,
    selectedChecklist,
    setSelectedChecklist,
    setVersionConflict,
  ]);

  const completeChecklist = useCallback(async () => {
    if (!selectedChecklist) {
      return;
    }

    const requiredError = validateRequiredDraftAnswers();

    if (requiredError) {
      setFormError(requiredError);
      return;
    }

    if (
      !window.confirm(
        "Завершить чек-лист? После завершения ответы нельзя будет изменить.",
      )
    ) {
      return;
    }

    let checklistForCompletion = selectedChecklist;

    if (hasUnsavedChanges) {
      const savedChecklist = await saveChecklist();

      if (!savedChecklist) {
        return;
      }

      checklistForCompletion = savedChecklist;
    }

    setIsActionLoading(true);
    setFormError(null);
    setVersionConflict(null);
    setMessage(null);
    setRefreshError(null);

    try {
      const detail = await completeChecklistWork(checklistForCompletion.id, {
        version: checklistForCompletion.version,
      });
      setSelectedChecklist(detail);
      setMessage(
        detail.event.status === "COMPLETED"
          ? "Чек-лист завершён. Событие завершено автоматически."
          : "Чек-лист завершён.",
      );

      try {
        await reloadItems();
      } catch (requestError) {
        handleRefreshError(
          requestError,
          "Чек-лист завершён, но список не удалось обновить.",
        );
      }
    } catch (requestError) {
      applyMutationError(requestError, "form");
    } finally {
      setIsActionLoading(false);
    }
  }, [
    applyMutationError,
    handleRefreshError,
    hasUnsavedChanges,
    reloadItems,
    saveChecklist,
    selectedChecklist,
    setSelectedChecklist,
    setVersionConflict,
    validateRequiredDraftAnswers,
  ]);

  return {
    clearActionState,
    completeChecklist,
    formError,
    isActionLoading,
    message,
    refreshError,
    saveChecklist,
    setMessage,
    startFromListItem,
    startSelectedChecklist,
  };
}
