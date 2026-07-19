import { useCallback } from "react";
import { getApiErrorMessage } from "../../../shared/api/api-error";
import {
  completeChecklistWork,
  getChecklistWorkDetail,
  saveChecklistWorkAnswers,
  startChecklistWork,
  type ChecklistWorkAnswerPayload,
  type ChecklistWorkDetail,
} from "../../../shared/api/checklists";
import { useChecklistUiState } from "./use-checklist-mutation-state";
import { useChecklistValidation } from "./use-checklist-validation";
import type { SaveChecklistResult } from "./checklist-actions.types";
import { mapChecklistActionError } from "../my-checklists.errors";
import type { DraftAnswers } from "../my-checklists.types";

type UseChecklistActionsParams = {
  changedAnswers: ChecklistWorkAnswerPayload[];
  draftAnswers: DraftAnswers;
  checklist: ChecklistWorkDetail | null;
  onChecklistChange: (checklist: ChecklistWorkDetail) => void;
};

export function useChecklistActions({
  changedAnswers,
  draftAnswers,
  checklist,
  onChecklistChange,
}: UseChecklistActionsParams) {
  const hasChanges = changedAnswers.length > 0;
  const state = useChecklistUiState();
  const {
    getRequiredDraftError,
    validateDraftBeforeMutation,
  } = useChecklistValidation({
    checklist,
    draftAnswers,
  });
  const {
    applyMutationError: applyMutationErrorState,
    formError,
    hideRequiredValidationErrors,
    isActionLoading,
    message,
    mutationDetailError,
    mutationVersionConflict,
    prepareMutation,
    refreshError,
    setIsActionLoading,
    showFormError,
    showMessage,
    showRefreshError,
    showRequiredErrors,
    showRequiredValidationErrors,
  } = state;

  const applyMutationError = useCallback(
    (error: unknown, target: "detail" | "form") => {
      const result = mapChecklistActionError(error, target);

      applyMutationErrorState({
        detailError: result.detailError,
        formError: result.formError,
        versionConflict: result.versionConflict,
      });
    },
    [applyMutationErrorState],
  );

  const handleRefreshError = useCallback(
    (error: unknown, fallbackMessage: string) => {
      showRefreshError(getApiErrorMessage(error) || fallbackMessage);
    },
    [showRefreshError],
  );

  const validateBeforeAction = useCallback(() => {
    const requiredDraftError = getRequiredDraftError();

    if (requiredDraftError) {
      showFormError(requiredDraftError);
      showRequiredValidationErrors();
      return requiredDraftError;
    }

    const draftError = validateDraftBeforeMutation();

    if (draftError) {
      showFormError(draftError);
      hideRequiredValidationErrors();
      return draftError;
    }

    hideRequiredValidationErrors();
    return null;
  }, [
    getRequiredDraftError,
    hideRequiredValidationErrors,
    showFormError,
    showRequiredValidationErrors,
    validateDraftBeforeMutation,
  ]);

  const startChecklist = useCallback(async () => {
    if (!checklist) {
      return;
    }

    prepareMutation();
    setIsActionLoading(true);

    try {
      const detail = await startChecklistWork(checklist.id, {
        version: checklist.version,
      });
      onChecklistChange(detail);
      showMessage("Чек-лист переведён в работу.");
    } catch (requestError) {
      applyMutationError(requestError, "detail");
    } finally {
      setIsActionLoading(false);
    }
  }, [
    applyMutationError,
    checklist,
    onChecklistChange,
    prepareMutation,
    setIsActionLoading,
    showMessage,
  ]);

  const persistChecklistAnswers = useCallback(
    async ({
      manageLoading = true,
      prepareUi = true,
    }: {
      manageLoading?: boolean;
      prepareUi?: boolean;
    } = {}): Promise<SaveChecklistResult> => {
      if (!checklist) {
        return {
          reason: "missing_checklist",
          success: false,
        };
      }

      if (prepareUi) {
        prepareMutation();
      }

      if (!hasChanges) {
        showMessage("Изменений для сохранения нет.");
        return {
          changed: false,
          checklist,
          success: true,
        };
      }

      if (manageLoading) {
        setIsActionLoading(true);
      }

      try {
        await saveChecklistWorkAnswers(checklist.id, {
          answers: changedAnswers,
          version: checklist.version,
        });

        try {
          const nextDetail = await getChecklistWorkDetail(checklist.id);
          onChecklistChange(nextDetail);
          showMessage("Ответы сохранены.");
          return {
            changed: true,
            checklist: nextDetail,
            success: true,
          };
        } catch (requestError) {
          handleRefreshError(
            requestError,
            "Ответы сохранены, но данные чек-листа не удалось обновить.",
          );
          return {
            reason: "reload_failed",
            success: false,
          };
        }
      } catch (requestError) {
        applyMutationError(requestError, "form");
        return {
          reason: "request",
          success: false,
        };
      } finally {
        if (manageLoading) {
          setIsActionLoading(false);
        }
      }
    },
    [
      applyMutationError,
      changedAnswers,
      hasChanges,
      checklist,
      handleRefreshError,
      onChecklistChange,
      prepareMutation,
      setIsActionLoading,
      showMessage,
    ],
  );

  const saveChecklist = useCallback(async (): Promise<SaveChecklistResult> => {
    if (!checklist) {
      return {
        reason: "missing_checklist",
        success: false,
      };
    }

    if (validateBeforeAction()) {
      return {
        reason: "validation",
        success: false,
      };
    }

    return persistChecklistAnswers();
  }, [checklist, persistChecklistAnswers, validateBeforeAction]);

  const completeChecklist = useCallback(async () => {
    if (!checklist) {
      return;
    }

    if (validateBeforeAction()) {
      return;
    }

    if (
      !window.confirm(
        "Завершить чек-лист? После завершения ответы нельзя будет изменить.",
      )
    ) {
      return;
    }

    let checklistForCompletion = checklist;

    prepareMutation();
    setIsActionLoading(true);

    try {
      if (hasChanges) {
        const saveResult = await persistChecklistAnswers({
          manageLoading: false,
          prepareUi: false,
        });

        if (!saveResult.success) {
          return;
        }

        checklistForCompletion = saveResult.checklist;
      }

      const detail = await completeChecklistWork(checklistForCompletion.id, {
        version: checklistForCompletion.version,
      });
      onChecklistChange(detail);
      showMessage(
        detail.event.status === "COMPLETED"
          ? "Чек-лист завершён. Событие завершено автоматически."
          : "Чек-лист завершён.",
      );
    } catch (requestError) {
      applyMutationError(requestError, "form");
    } finally {
      setIsActionLoading(false);
    }
  }, [
    applyMutationError,
    hasChanges,
    checklist,
    onChecklistChange,
    prepareMutation,
    persistChecklistAnswers,
    setIsActionLoading,
    showMessage,
    validateBeforeAction,
  ]);

  return {
    completeChecklist,
    formError,
    isActionLoading,
    message,
    mutationDetailError,
    mutationVersionConflict,
    refreshError,
    saveChecklist,
    showRequiredErrors,
    startChecklist,
  };
}
