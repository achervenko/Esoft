import { useCallback } from "react";
import type { ChecklistWorkDetail } from "../../../shared/api/checklists";
import {
  validateDraftAnswers,
  validateRequiredAnswers,
} from "../my-checklists.answers";
import type { DraftAnswers } from "../my-checklists.types";

type UseChecklistValidationParams = {
  checklist: ChecklistWorkDetail | null;
  draftAnswers: DraftAnswers;
};

export function useChecklistValidation({
  checklist,
  draftAnswers,
}: UseChecklistValidationParams) {
  const getRequiredDraftError = useCallback(() => {
    if (!checklist) {
      return null;
    }

    return validateRequiredAnswers(checklist, draftAnswers);
  }, [checklist, draftAnswers]);

  const validateDraftBeforeMutation = useCallback(() => {
    if (!checklist) {
      return null;
    }

    return validateDraftAnswers(checklist, draftAnswers);
  }, [checklist, draftAnswers]);

  return {
    getRequiredDraftError,
    validateDraftBeforeMutation,
  };
}
