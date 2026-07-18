import { useCallback, useEffect, useRef, useState } from "react";
import { getApiErrorMessage } from "../../../shared/api/api-error";
import {
  getChecklistWorkItems,
  type ChecklistWorkListItem,
} from "../../../shared/api/checklists";
import { tabConfig } from "../my-checklists.config";
import type { UseMyChecklistsListParams } from "../my-checklists.types";

export function useMyChecklistsList({
  activeTab,
  onSelectedChecklistMissing,
  selectedChecklistId,
}: UseMyChecklistsListParams) {
  const [items, setItems] = useState<ChecklistWorkListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);
  const isMountedRef = useRef(true);

  const reload = useCallback(async () => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    const response = await getChecklistWorkItems({
      limit: 100,
      status: tabConfig[activeTab].statuses,
    });

    if (!isMountedRef.current || requestIdRef.current !== requestId) {
      return null;
    }

    setItems(response.items);

    return response.items;
  }, [activeTab]);

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
      requestIdRef.current += 1;
    };
  }, []);

  useEffect(() => {
    setIsLoading(true);
    setError(null);

    reload()
      .catch((requestError) => {
        if (!isMountedRef.current) {
          return;
        }

        setError(getApiErrorMessage(requestError));
        setItems([]);
        onSelectedChecklistMissing();
      })
      .finally(() => {
        if (isMountedRef.current) {
          setIsLoading(false);
        }
      });
  }, [onSelectedChecklistMissing, reload]);

  useEffect(() => {
    if (
      selectedChecklistId !== null &&
      !items.some((item) => item.id === selectedChecklistId)
    ) {
      onSelectedChecklistMissing();
    }
  }, [items, onSelectedChecklistMissing, selectedChecklistId]);

  return {
    error,
    isLoading,
    items,
    reload,
  };
}
