import { useCallback, useEffect, useMemo, useState } from "react";
import type { ChecklistWorkDetail } from "../../../shared/api/checklists";
import {
  buildDraftAnswers,
  getChangedAnswers,
} from "../my-checklists.answers";
import type { DraftAnswers } from "../my-checklists.types";

type UseChecklistDraftParams = {
  checklist: ChecklistWorkDetail | null;
};

export function useChecklistDraft({
  checklist,
}: UseChecklistDraftParams) {
  const [draftAnswers, setDraftAnswers] = useState<DraftAnswers>({});

  useEffect(() => {
    setDraftAnswers(checklist ? buildDraftAnswers(checklist) : {});
  }, [checklist]);

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
      checklist === null ? [] : getChangedAnswers(checklist, draftAnswers),
    [draftAnswers, checklist],
  );

  const hasUnsavedChanges = changedAnswers.length > 0;

  const resetDraftAnswers = useCallback(() => {
    setDraftAnswers(checklist ? buildDraftAnswers(checklist) : {});
  }, [checklist]);

  return {
    changedAnswers,
    draftAnswers,
    hasUnsavedChanges,
    resetDraftAnswers,
    setAnswerValue,
  };
}
