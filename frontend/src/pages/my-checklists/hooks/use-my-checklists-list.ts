import { useEffect, useState } from "react";
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
  const [selection, setSelection] = useState({ tab: activeTab, page: 0 });
  const page = selection.tab === activeTab ? selection.page : 0;
  const pageSize = 100;
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
      const response = await getChecklistWorkItems({
          limit: pageSize,
          offset: page * pageSize,
          status: tabConfig[activeTab].statuses,
        });
        if (cancelled) return;
        if (page > 0 && page * pageSize >= response.total) {
          setSelection({ tab: activeTab, page: Math.max(0, Math.ceil(response.total / pageSize) - 1) });
          return;
        }
        if (response.items.length === 0 && response.total > 0)
          throw new Error("Не удалось загрузить полный список чек-листов.");
      setItems(response.items);
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
  }, [activeTab, page]);

  return {
    error,
    isLoading,
    items,
    total,
    totalsByStatus,
    page,
    pageSize,
    setPage: (nextPage) => setSelection({ tab: activeTab, page: Math.max(0, Math.min(nextPage, Math.ceil(total / pageSize) - 1)) }),
  };
}
