import { useIncrementalList } from "../../../shared/lib/useIncrementalList";
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
  const list = useIncrementalList<
    ChecklistWorkListItem,
    Pick<ChecklistWorkListResponse, "totalsByStatus">
  >({
    queryKey: activeTab,
    enabled: true,
    getKey: (item) => item.id,
    loadPage: async (offset, signal) => {
      const response = await getChecklistWorkItems(
        { limit: 100, offset, status: tabConfig[activeTab].statuses },
        signal,
      );
      if (!response.items.length && offset < response.total)
        throw new Error("Не удалось загрузить полный список чек-листов.");
      return { ...response, limit: 100 };
    },
  });
  return {
    list,
    error: !list.data ? list.error : null,
    isLoading: list.loading && !list.data,
    items: list.data?.items ?? [],
    total: list.data?.total ?? 0,
    totalsByStatus: list.data?.totalsByStatus ?? {},
  };
}
