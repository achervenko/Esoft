import { useChecklistActions } from "./use-checklist-actions";
import { useChecklistDetail } from "./use-checklist-detail";
import { useChecklistDraft } from "./use-checklist-draft";
import type { UseChecklistWorkParams } from "../my-checklists.types";
import type { ChecklistWorkDetail } from "../../../shared/api/checklists";

function canMutateChecklist(
  checklist: ChecklistWorkDetail | null,
  currentUserId: string | null,
) {
  return checklist !== null && checklist.assignedUser.id === currentUserId;
}

export function useChecklistWork({
  checklistId,
  currentUserId,
}: UseChecklistWorkParams) {
  const {
    checklist,
    detailError: loadedDetailError,
    isDetailLoading,
    reloadChecklist,
    replaceChecklist,
    versionConflict: loadedVersionConflict,
  } = useChecklistDetail({
    checklistId,
  });
  const {
    changedAnswers,
    draftAnswers,
    draftResult,
    hasResultChange,
    hasUnsavedChanges,
    setAnswerValue,
    setResultValue,
  } = useChecklistDraft({
    checklist,
  });
  const {
    completeChecklist,
    formError,
    isActionLoading,
    message,
    mutationDetailError,
    mutationVersionConflict,
    refreshError,
    resultError,
    saveChecklist,
    showRequiredErrors,
  } = useChecklistActions({
    changedAnswers,
    checklist,
    draftAnswers,
    draftResult,
    hasResultChange,
    onChecklistChange: replaceChecklist,
  });

  const canMutateSelected = canMutateChecklist(checklist, currentUserId);

  const detailError = mutationDetailError ?? loadedDetailError;
  const versionConflict = mutationVersionConflict ?? loadedVersionConflict;

  return {
    canMutateSelected,
    checklist,
    completeChecklist,
    detailError,
    draftAnswers,
    draftResult,
    formError,
    hasUnsavedChanges,
    isActionLoading,
    isDetailLoading,
    message,
    refreshError,
    reloadChecklist,
    saveChecklist,
    setAnswerValue,
    setResultValue,
    resultError,
    showRequiredErrors,
    versionConflict,
  };
}
