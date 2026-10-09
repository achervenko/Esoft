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

  const loadTemplates = useCallback(async () => {
    if (!enabled) {
      requestIdRef.current += 1;
      setIsLoading(false);
      setError(null);
      setTemplates([]);
      return;
    }

    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    setIsLoading(true);
    setError(null);
    setTemplates([]);

    try {
      const loaded: ChecklistTemplateListItem[] = [];
      let page = 1;
      let total: number;
      do {
        const response = await getChecklistTemplates({
          limit: 200,
          page,
          search: appliedFilters.search.trim(),
          state: appliedFilters.state,
        });
        if (requestIdRef.current !== requestId) return;
        loaded.push(...response.items);
        total = response.total;
        if (response.items.length === 0 && loaded.length < total)
          throw new Error("Не удалось загрузить полный список шаблонов.");
        page += 1;
      } while (loaded.length < total);
      setTemplates(loaded);
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
  }, [appliedFilters.search, appliedFilters.state, enabled]);

  useEffect(() => {
    void loadTemplates();
    return () => {
      requestIdRef.current += 1;
    };
  }, [loadTemplates, reloadKey]);

  const applyFilters = useCallback(() => {
    setAppliedFilters({ search, state });
    setReloadKey((currentKey) => currentKey + 1);
  }, [search, state]);

  const reload = useCallback(() => loadTemplates(), [loadTemplates]);

  return {
    error,
    isLoading,
    search,
    state,
    templates,
    applyFilters,
    reload,
    setSearch,
    setState,
  };
}
