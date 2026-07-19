import { useCallback, useEffect, useRef, useState } from "react";
import {
  getChecklistWorkDetail,
  type ChecklistWorkDetail,
} from "../../../shared/api/checklists";
import { mapChecklistActionError } from "../my-checklists.errors";

type UseChecklistDetailParams = {
  checklistId: number;
};

export function useChecklistDetail({
  checklistId,
}: UseChecklistDetailParams) {
  const [checklist, setChecklist] = useState<ChecklistWorkDetail | null>(null);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [versionConflict, setVersionConflict] = useState<string | null>(null);
  const detailRequestIdRef = useRef(0);

  const applyDetailError = useCallback((error: unknown) => {
    const result = mapChecklistActionError(error, "detail");

    setDetailError(result.detailError);
    setVersionConflict(result.versionConflict);
  }, []);

  const loadChecklist = useCallback(async () => {
    const requestId = detailRequestIdRef.current + 1;
    detailRequestIdRef.current = requestId;

    setIsDetailLoading(true);
    setDetailError(null);
    setVersionConflict(null);

    try {
      const detail = await getChecklistWorkDetail(checklistId);

      if (detailRequestIdRef.current !== requestId) {
        return null;
      }

      setChecklist(detail);
      return detail;
    } catch (requestError) {
      if (detailRequestIdRef.current === requestId) {
        applyDetailError(requestError);
      }

      return null;
    } finally {
      if (detailRequestIdRef.current === requestId) {
        setIsDetailLoading(false);
      }
    }
  }, [applyDetailError, checklistId]);

  const reloadChecklist = useCallback(async () => {
    return loadChecklist();
  }, [loadChecklist]);

  const replaceChecklist = useCallback((nextChecklist: ChecklistWorkDetail) => {
    setChecklist(nextChecklist);
  }, []);

  useEffect(() => {
    void loadChecklist();
  }, [loadChecklist]);

  return {
    checklist,
    detailError,
    isDetailLoading,
    reloadChecklist,
    replaceChecklist,
    versionConflict,
  };
}
