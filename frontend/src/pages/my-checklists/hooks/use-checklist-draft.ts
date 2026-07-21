import { useCallback, useEffect, useMemo, useState } from "react";
import type { ChecklistWorkDetail } from "../../../shared/api/checklists";
import type { ChecklistResult } from "../../../shared/api/checklists";
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
  const [draftResult, setDraftResult] = useState<ChecklistResult | null>(null);

  useEffect(() => {
    setDraftAnswers(checklist ? buildDraftAnswers(checklist) : {});
    setDraftResult(checklist?.result ?? null);
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

  const hasResultChange = checklist !== null && draftResult !== checklist.result;
  const hasUnsavedChanges = changedAnswers.length > 0 || hasResultChange;

  const resetDraftAnswers = useCallback(() => {
    setDraftAnswers(checklist ? buildDraftAnswers(checklist) : {});
    setDraftResult(checklist?.result ?? null);
  }, [checklist]);

  return {
    changedAnswers,
    draftAnswers,
    draftResult,
    hasResultChange,
    hasUnsavedChanges,
    resetDraftAnswers,
    setAnswerValue,
    setResultValue: setDraftResult,
  };
}
