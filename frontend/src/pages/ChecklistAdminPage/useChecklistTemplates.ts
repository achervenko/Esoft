import { useCallback, useEffect, useRef, useState } from "react";
import {
  getChecklistAdminErrorMessage,
  getChecklistTemplates,
  type ChecklistTemplateListItem,
} from "../../shared/api/checklists";

const defaultTemplateFilters = {
  search: "",
  state: "ACTIVE",
};

export function useChecklistTemplates({ enabled }: { enabled: boolean }) {
  const [templates, setTemplates] = useState<ChecklistTemplateListItem[]>([]);
  const [search, setSearch] = useState("");
  const [state, setState] = useState("ACTIVE");
  const [appliedFilters, setAppliedFilters] = useState(defaultTemplateFilters);
  const [reloadKey, setReloadKey] = useState(0);
  const [isLoading, setIsLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const pageSize = 100;

  const loadTemplates = useCallback(async () => {
    if (!enabled) {
      requestIdRef.current += 1;
      setIsLoading(false);
      setError(null);
      setTemplates([]);
      setTotal(0);
      return;
    }

    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    setIsLoading(true);
    setError(null);
    setTemplates([]);

    try {
        const response = await getChecklistTemplates({
          limit: pageSize,
          page: page + 1,
          search: appliedFilters.search.trim(),
          state: appliedFilters.state,
        });
        if (requestIdRef.current !== requestId) return;
        if (page > 0 && page * pageSize >= response.total) {
          setPage(Math.max(0, Math.ceil(response.total / pageSize) - 1));
          return;
        }
        if (response.items.length === 0 && response.total > 0)
          throw new Error("Не удалось загрузить полный список шаблонов.");
      setTemplates(response.items);
      setTotal(response.total);
    } catch (requestError) {
      if (requestIdRef.current === requestId) {
        setTemplates([]);
        setError(getChecklistAdminErrorMessage(requestError));
      }
    } finally {
      if (requestIdRef.current === requestId) {
        setIsLoading(false);
      }
    }
  }, [appliedFilters.search, appliedFilters.state, enabled, page]);

  useEffect(() => {
    void loadTemplates();
    return () => {
      requestIdRef.current += 1;
    };
  }, [loadTemplates, reloadKey]);

  const applyFilters = useCallback((next?: { search?: string; state?: string }) => {
    const nextSearch = next?.search ?? search;
    const nextState = next?.state ?? state;
    setSearch(nextSearch);
    setState(nextState);
    setPage(0);
    setAppliedFilters({ search: nextSearch, state: nextState });
    setReloadKey((currentKey) => currentKey + 1);
  }, [search, state]);

  const reload = useCallback(() => loadTemplates(), [loadTemplates]);

  return {
    error,
    isLoading,
    search,
    state,
    templates,
    page,
    total,
    pageSize,
    setPage,
    applyFilters,
    reload,
    setSearch,
    setState,
  };
}
