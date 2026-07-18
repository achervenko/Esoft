import { useMemo } from "react";
import { useChecklistActions } from "./use-checklist-actions";
import { useChecklistDetail } from "./use-checklist-detail";
import { useChecklistDraft } from "./use-checklist-draft";
import type { UseChecklistWorkParams } from "../my-checklists.types";

export function useChecklistWork({
  currentUserId,
  onSelectChecklistId,
  reloadItems,
  selectedChecklistId,
  onChecklistStarted,
}: UseChecklistWorkParams) {
  const detail = useChecklistDetail({
    onSelectChecklistId,
    selectedChecklistId,
  });
  const draft = useChecklistDraft({
    selectedChecklist: detail.selectedChecklist,
  });
  const actions = useChecklistActions({
    changedAnswers: draft.changedAnswers,
    hasUnsavedChanges: draft.hasUnsavedChanges,
    onChecklistStarted,
    onSelectChecklistId,
    reloadItems,
    selectedChecklist: detail.selectedChecklist,
    setDetailError: detail.setDetailError,
    setSelectedChecklist: detail.setSelectedChecklist,
    setVersionConflict: detail.setVersionConflict,
    validateRequiredDraftAnswers: draft.validateRequiredDraftAnswers,
  });

  const canMutateSelected = useMemo(
    () =>
      detail.selectedChecklist !== null &&
      detail.selectedChecklist.assignedUser.id === currentUserId,
    [currentUserId, detail.selectedChecklist],
  );

  return {
    canMutateSelected,
    clearSelectedChecklist: detail.clearSelectedChecklist,
    completeChecklist: actions.completeChecklist,
    detailError: detail.detailError,
    draftAnswers: draft.draftAnswers,
    formError: actions.formError,
    hasUnsavedChanges: draft.hasUnsavedChanges,
    isActionLoading: actions.isActionLoading,
    isDetailLoading: detail.isDetailLoading,
    message: actions.message,
    openChecklist: detail.openChecklist,
    refreshError: actions.refreshError,
    reloadSelectedChecklist: detail.reloadSelectedChecklist,
    saveChecklist: actions.saveChecklist,
    selectedChecklist: detail.selectedChecklist,
    setAnswerValue: draft.setAnswerValue,
    setMessage: actions.setMessage,
    startFromListItem: actions.startFromListItem,
    startSelectedChecklist: actions.startSelectedChecklist,
    versionConflict: detail.versionConflict,
  };
}
