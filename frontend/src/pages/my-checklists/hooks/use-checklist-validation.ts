import { useCallback } from "react";
import type {
  ChecklistResult,
  ChecklistWorkDetail,
} from "../../../shared/api/checklists";
import {
  validateDraftAnswers,
  validateRequiredAnswers,
} from "../my-checklists.answers";
import type { DraftAnswers } from "../my-checklists.types";

type UseChecklistValidationParams = {
  checklist: ChecklistWorkDetail | null;
  draftAnswers: DraftAnswers;
  draftResult: ChecklistResult | null;
};

export function useChecklistValidation({
  checklist,
  draftAnswers,
  draftResult,
}: UseChecklistValidationParams) {
  const getRequiredDraftError = useCallback(() => {
    if (!checklist) {
      return null;
    }

    return validateRequiredAnswers(checklist, draftAnswers);
  }, [checklist, draftAnswers]);

  const getRequiredResultError = useCallback(() => {
    if (!checklist || draftResult) {
      return null;
    }

    return "Укажите результат проверки.";
  }, [checklist, draftResult]);

  const validateDraftBeforeMutation = useCallback(() => {
    if (!checklist) {
      return null;
    }

    return validateDraftAnswers(checklist, draftAnswers);
  }, [checklist, draftAnswers]);

  return {
    getRequiredResultError,
    getRequiredDraftError,
    validateDraftBeforeMutation,
  };
}
