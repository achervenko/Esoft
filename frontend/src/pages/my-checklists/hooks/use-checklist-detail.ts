import { useCallback, useEffect, useRef, useState } from "react";
import {
  getChecklistWorkDetail,
  type ChecklistWorkDetail,
} from "../../../shared/api/checklists";
import { mapChecklistActionError } from "../my-checklists.errors";

type UseChecklistDetailParams = {
  onSelectChecklistId: (checklistId: number | null) => void;
  selectedChecklistId: number | null;
};

export function useChecklistDetail({
  onSelectChecklistId,
  selectedChecklistId,
}: UseChecklistDetailParams) {
  const [selectedChecklist, setSelectedChecklist] =
    useState<ChecklistWorkDetail | null>(null);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [versionConflict, setVersionConflict] = useState<string | null>(null);
  const detailRequestIdRef = useRef(0);

  const applyDetailError = useCallback((error: unknown) => {
    const result = mapChecklistActionError(error, "detail");

    setDetailError(result.detailError);
    setVersionConflict(result.versionConflict);
  }, []);

  const loadChecklistDetail = useCallback(
    async (checklistId: number) => {
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

        onSelectChecklistId(detail.id);
        setSelectedChecklist(detail);
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
    },
    [applyDetailError, onSelectChecklistId],
  );

  const clearSelectedChecklist = useCallback(() => {
    onSelectChecklistId(null);
    setSelectedChecklist(null);
    setDetailError(null);
    setVersionConflict(null);
    detailRequestIdRef.current += 1;
  }, [onSelectChecklistId]);

  const openChecklist = useCallback(
    async (checklistId: number) => {
      await loadChecklistDetail(checklistId);
    },
    [loadChecklistDetail],
  );

  const reloadSelectedChecklist = useCallback(async () => {
    if (selectedChecklistId === null) {
      return;
    }

    await loadChecklistDetail(selectedChecklistId);
  }, [loadChecklistDetail, selectedChecklistId]);

  useEffect(() => {
    if (selectedChecklistId === null) {
      setSelectedChecklist(null);
      setDetailError(null);
      setVersionConflict(null);
      detailRequestIdRef.current += 1;
    }
  }, [selectedChecklistId]);

  return {
    clearSelectedChecklist,
    detailError,
    isDetailLoading,
    loadChecklistDetail,
    openChecklist,
    reloadSelectedChecklist,
    selectedChecklist,
    setDetailError,
    setSelectedChecklist,
    setVersionConflict,
    versionConflict,
  };
}
