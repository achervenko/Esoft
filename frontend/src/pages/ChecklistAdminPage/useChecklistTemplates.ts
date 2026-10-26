import { useCallback, useState } from "react";
import {
  getChecklistTemplates,
  type ChecklistTemplateListItem,
} from "../../shared/api/checklists";
import { useIncrementalList } from "../../shared/lib/useIncrementalList";
const defaultTemplateFilters = { search: "", state: "ACTIVE" };
export type ChecklistTemplateSort = {
  key: "name" | "state" | "questions";
  direction: "asc" | "desc";
};
export function useChecklistTemplates({ enabled }: { enabled: boolean }) {
  const [search, setSearch] = useState("");
  const [state, setState] = useState("ACTIVE");
  const [appliedFilters, setAppliedFilters] = useState(defaultTemplateFilters);
  const [revision, setRevision] = useState(0);
  const [sort, setSort] = useState<ChecklistTemplateSort>({
    key: "name",
    direction: "asc",
  });
  const list = useIncrementalList({
    queryKey: JSON.stringify([appliedFilters, revision, sort]),
    enabled,
    getKey: (item: ChecklistTemplateListItem) => item.id,
    loadPage: async (offset, signal) => {
      const response = await getChecklistTemplates(
        {
          limit: 100,
          page: Math.floor(offset / 100) + 1,
          search: appliedFilters.search.trim(),
          state: appliedFilters.state,
          sortBy: sort.key === "questions" ? "questionCount" : sort.key,
          sortDirection: sort.direction,
        },
        signal,
      );
      if (!response.items.length && offset < response.total)
        throw new Error("Не удалось загрузить полный список шаблонов.");
      return { ...response, limit: 100 };
    },
  });
  const applyFilters = useCallback(
    (next?: { search?: string; state?: string }) => {
      const nextSearch = next?.search ?? search,
        nextState = next?.state ?? state;
      setSearch(nextSearch);
      setState(nextState);
      setAppliedFilters({ search: nextSearch, state: nextState });
      setRevision((value) => value + 1);
    },
    [search, state],
  );
  return {
    list,
    sort,
    setSort,
    error: !list.data ? list.error : null,
    isLoading: list.loading && !list.data,
    templates: list.data?.items ?? [],
    total: list.data?.total ?? 0,
    search,
    state,
    setSearch,
    setState,
    applyFilters,
    reload: async () => {
      setRevision((value) => value + 1);
    },
  };
}
