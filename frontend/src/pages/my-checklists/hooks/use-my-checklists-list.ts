import { useCallback, useEffect, useRef, useState } from "react";
import { getApiErrorMessage } from "../../../shared/api/api-error";
import {
  getChecklistWorkItems,
  type ChecklistWorkListItem,
} from "../../../shared/api/checklists";
import { tabConfig } from "../my-checklists.config";
import type {
  MyChecklistsListState,
  UseMyChecklistsListParams,
} from "../my-checklists.types";

export function useMyChecklistsList({
  activeTab,
}: UseMyChecklistsListParams): MyChecklistsListState {
  const [items, setItems] = useState<ChecklistWorkListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [totalsByStatus, setTotalsByStatus] = useState<
    MyChecklistsListState["totalsByStatus"]
  >({});
  const requestIdRef = useRef(0);
  const isMountedRef = useRef(true);

  const load = useCallback(async () => {
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
    setTotal(response.total);
    setTotalsByStatus(response.totalsByStatus);

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

    load()
      .catch((requestError) => {
        if (!isMountedRef.current) {
          return;
        }

        setError(getApiErrorMessage(requestError));
        setItems([]);
        setTotal(0);
        setTotalsByStatus({});
      })
      .finally(() => {
        if (isMountedRef.current) {
          setIsLoading(false);
        }
      });
  }, [load]);

  return {
    error,
    isLoading,
    items,
    total,
    totalsByStatus,
  };
}
