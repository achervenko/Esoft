import { useCallback, useEffect, useMemo, useState } from "react";
import type { ChecklistWorkDetail } from "../../../shared/api/checklists";
import {
  buildDraftAnswers,
  getChangedAnswers,
  validateRequiredAnswers,
} from "../my-checklists.answers";
import type { DraftAnswers } from "../my-checklists.types";

type UseChecklistDraftParams = {
  selectedChecklist: ChecklistWorkDetail | null;
};

export function useChecklistDraft({
  selectedChecklist,
}: UseChecklistDraftParams) {
  const [draftAnswers, setDraftAnswers] = useState<DraftAnswers>({});

  useEffect(() => {
    setDraftAnswers(selectedChecklist ? buildDraftAnswers(selectedChecklist) : {});
  }, [selectedChecklist]);

  const setAnswerValue = useCallback(
    (checklistDetailId: number, value: string) => {
      setDraftAnswers((current) => ({
        ...current,
        [checklistDetailId]: value,
      }));
    },
    [],
  );

  const changedAnswers = useMemo(
    () =>
      selectedChecklist === null
        ? []
        : getChangedAnswers(selectedChecklist, draftAnswers),
    [draftAnswers, selectedChecklist],
  );

  const hasUnsavedChanges = changedAnswers.length > 0;

  const validateRequiredDraftAnswers = useCallback(() => {
    if (!selectedChecklist) {
      return null;
    }

    return validateRequiredAnswers(selectedChecklist, draftAnswers);
  }, [draftAnswers, selectedChecklist]);

  const resetDraftAnswers = useCallback(() => {
    setDraftAnswers(selectedChecklist ? buildDraftAnswers(selectedChecklist) : {});
  }, [selectedChecklist]);

  return {
    changedAnswers,
    draftAnswers,
    hasUnsavedChanges,
    resetDraftAnswers,
    setAnswerValue,
    validateRequiredDraftAnswers,
  };
}
