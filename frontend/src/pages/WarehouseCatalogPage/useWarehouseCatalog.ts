import { useEffect, useRef, useState } from "react";
import {
  warehouseCatalogApi,
  warehouseCatalogError,
  type WarehouseItem,
  type WarehouseItemInput,
  type WarehouseCatalogError,
} from "../../shared/api/warehouse-catalog-api";
import { useIncrementalList } from "../../shared/lib/useIncrementalList";
import { useConfirmation } from "../../shared/ui/useConfirmation";

function readWarehouseQuery() {
  const params = new URLSearchParams(window.location.hash.split("?")[1]);
  const active = params.get("isActive");
  return {
    search: params.get("q") ?? "",
    active: active === "true" || active === "false" ? active : "",
  };
}

export function useWarehouseCatalog(enabled: boolean) {
  const [query, setQuery] = useState(readWarehouseQuery);
  const [settledSearch, setSettledSearch] = useState(query.search);
  const [mutationError, setMutationError] =
    useState<WarehouseCatalogError | null>(null);
  const [revision, setRevision] = useState(0);
  const [editing, setEditing] = useState<WarehouseItem | "new" | null>(null);
  const [saving, setSaving] = useState(false);
  const saveBusy = useRef(false);
  const confirm = useConfirmation();
  useEffect(() => {
    const timer = window.setTimeout(() => setSettledSearch(query.search), 250);
    return () => window.clearTimeout(timer);
  }, [query.search]);
  useEffect(() => {
    const syncFromHash = () => {
      if (window.location.hash.split("?")[0] !== "#/warehouse/catalog") return;
      const next = readWarehouseQuery();
      setQuery(next);
      setSettledSearch(next.search);
    };
    window.addEventListener("hashchange", syncFromHash);
    return () => window.removeEventListener("hashchange", syncFromHash);
  }, []);
  const list = useIncrementalList({
    queryKey: JSON.stringify([settledSearch, query.active, revision]),
    enabled: enabled && query.search === settledSearch,
    getKey: (item: WarehouseItem) => item.id,
    loadPage: (offset, signal) => {
      const params = new URLSearchParams({
        limit: "50",
        offset: String(offset),
      });
      if (settledSearch.trim()) params.set("q", settledSearch.trim());
      if (query.active) params.set("isActive", query.active);
      return warehouseCatalogApi.list(params, signal);
    },
  });
  useEffect(() => {
    if (
      !enabled ||
      window.location.hash.split("?")[0] !== "#/warehouse/catalog"
    )
      return;
    const params = new URLSearchParams();
    if (query.search) params.set("q", query.search);
    if (query.active) params.set("isActive", query.active);
    window.history.replaceState(
      null,
      "",
      `#/warehouse/catalog${params.size ? `?${params}` : ""}`,
    );
  }, [query.search, query.active, enabled]);
  const openForm = (item: WarehouseItem | "new") => {
    setMutationError(null);
    setEditing(item);
  };
  const closeForm = () => {
    if (!saveBusy.current) {
      setEditing(null);
      setMutationError(null);
    }
  };
  async function save(input: WarehouseItemInput) {
    if (!enabled || !editing || saveBusy.current) return;
    const patch =
      editing === "new"
        ? input
        : Object.fromEntries(
            Object.entries(input).filter(
              ([key, value]) =>
                value !== editing[key as keyof WarehouseItemInput],
            ),
          );
    if (!Object.keys(patch).length) return;
    saveBusy.current = true;
    setSaving(true);
    setMutationError(null);
    try {
      if (editing === "new") await warehouseCatalogApi.create(input);
      else await warehouseCatalogApi.update(editing.id, patch);
      setEditing(null);
      setRevision((v) => v + 1);
    } catch (error) {
      setMutationError(warehouseCatalogError(error));
    } finally {
      saveBusy.current = false;
      setSaving(false);
    }
  }
  async function toggle(item: WarehouseItem) {
    if (!enabled || saveBusy.current) return;
    saveBusy.current = true;
    setSaving(true);
    setMutationError(null);
    try {
      if (
        item.isActive &&
        !(await confirm({
          title: "Деактивировать позицию?",
          description:
            "Позиция и история сохранятся. Новые обычные складские операции с ней будут недоступны.",
          confirmLabel: "Деактивировать",
        }))
      )
        return;
      const updated = await warehouseCatalogApi.setStatus(
        item.id,
        !item.isActive,
      );
      setEditing(updated);
      setRevision((v) => v + 1);
    } catch (error) {
      setMutationError(warehouseCatalogError(error));
    } finally {
      saveBusy.current = false;
      setSaving(false);
    }
  }
  return {
    query,
    setSearch: (search: string) => setQuery((v) => ({ ...v, search })),
    setActive: (active: string) => {
      setSettledSearch(query.search);
      setQuery((v) => ({ ...v, active }));
    },
    data: list.data,
    list,
    loading: (list.loading && !list.data) || query.search !== settledSearch,
    loadError: !list.data ? list.error : null,
    mutationError,
    editing,
    saving,
    openForm,
    closeForm,
    save,
    toggle,
    reload: () => {
      setSettledSearch(query.search);
      setRevision((v) => v + 1);
    },
  };
}
