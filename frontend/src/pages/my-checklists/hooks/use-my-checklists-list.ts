import { useEffect, useState } from "react";
import { getApiErrorMessage } from "../../../shared/api/api-error";
import {
  getChecklistWorkItems,
  type ChecklistWorkListItem,
  type ChecklistWorkListResponse,
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
  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    setItems([]);
    setTotal(0);
    setTotalsByStatus({});

    const load = async () => {
      const loaded: ChecklistWorkListItem[] = [];
      let response: ChecklistWorkListResponse;
      do {
        response = await getChecklistWorkItems({
          limit: 100,
          offset: loaded.length,
          status: tabConfig[activeTab].statuses,
        });
        if (cancelled) return;
        loaded.push(...response.items);
        if (response.items.length === 0 && loaded.length < response.total)
          throw new Error("Не удалось загрузить полный список чек-листов.");
      } while (loaded.length < response.total);
      setItems(loaded);
      setTotal(response.total);
      setTotalsByStatus(response.totalsByStatus);
    };

    void load()
      .catch((requestError) => {
        if (cancelled) {
          return;
        }

        setError(getApiErrorMessage(requestError));
        setItems([]);
        setTotal(0);
        setTotalsByStatus({});
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [activeTab]);

  return {
    error,
    isLoading,
    items,
    total,
    totalsByStatus,
  };
}
