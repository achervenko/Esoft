import { StorageLocationForm } from "./StorageLocationForm";
import {
  StorageLocationsTable,
  type StorageLocationsSort,
} from "./StorageLocationsTable";
import { SearchToolbar } from "../../shared/ui/SearchToolbar";
import { StorageLocationsFiltersModal } from "./StorageLocationsFiltersModal";
import "./StorageLocationsPanel.css";
import { useRef, useState } from "react";
import {
  storageLocationsApi,
  type StorageLocation,
} from "../../shared/api/storage-locations-api";
import { getApiErrorMessage } from "../../shared/api/api-error";
import { Notice } from "../../shared/ui/Notice";
import { useIncrementalList } from "../../shared/lib/useIncrementalList";
import { ListLoadMore } from "../../shared/ui/ListLoadMore";
import { useConfirmation } from "../../shared/ui/useConfirmation";

export function StorageLocationsPanel({ canManage }: { canManage: boolean }) {
  const [search, setSearch] = useState("");
  const [active, setActive] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sort, setSort] = useState<StorageLocationsSort>({
    key: "code",
    direction: "asc",
  });
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const [editing, setEditing] = useState<StorageLocation | "new" | null>(null);
  const [saving, setSaving] = useState(false);
  const busy = useRef(false);
  const confirm = useConfirmation();
  const list = useIncrementalList({
    queryKey: JSON.stringify([search, active, sort, revision]),
    enabled: true,
    getKey: (item: StorageLocation) => item.id,
    loadPage: (offset, signal) => {
      const q = new URLSearchParams({
        search,
        page: String(Math.floor(offset / 50) + 1),
        limit: "50",
        sortBy: sort.key,
        sortOrder: sort.direction,
      });
      if (active) q.set("isActive", active);
      return storageLocationsApi.list(q, signal);
    },
  });
  const data = list.data;
  const loading = list.loading && !data;
  const loadError = !data ? list.error : null;
  async function mutate(action: () => Promise<unknown>) {
    if (busy.current) return;
    busy.current = true;
    setSaving(true);
    setMutationError(null);
    try {
      await action();
      setEditing(null);
      setRevision((v) => v + 1);
      return true;
    } catch (e) {
      setMutationError(getApiErrorMessage(e));
      return false;
    } finally {
      busy.current = false;
      setSaving(false);
    }
  }
  async function toggle(item: StorageLocation) {
    if (busy.current) return;
    if (item.isActive) {
      busy.current = true;
      setSaving(true);
      setMutationError(null);
      let confirmed = false;
      try {
        const current = await storageLocationsApi.get(item.id);
        confirmed = await confirm({
          title: "Деактивировать место?",
          description: current.hasStock
            ? "На месте есть остаток. Он и история сохранятся, обычные новые операции будут недоступны."
            : "Место станет недоступно для обычных новых операций. История сохранится.",
          confirmLabel: "Деактивировать",
        });
      } catch (e) {
        setMutationError(getApiErrorMessage(e));
      } finally {
        busy.current = false;
        setSaving(false);
      }
      if (!confirmed) return;
    }
    await mutate(() =>
      storageLocationsApi.update(item.id, { isActive: !item.isActive }),
    );
  }
  return (
    <section className="storage-locations-panel" aria-label="Места хранения">
      <SearchToolbar
        value={search}
        onChange={(value) => {
          setSearch(value);
        }}
        label="Поиск мест хранения"
        onCreate={
          canManage
            ? () => {
                setMutationError(null);
                setEditing("new");
              }
            : undefined
        }
        createAriaLabel="Добавить место"
        createDisabled={saving}
        filters={{
          label: "Настройки поиска мест хранения",
          count: active ? 1 : 0,
          onOpen: () => setFiltersOpen(true),
        }}
      />
      {loadError && (
        <Notice tone="error">
          {loadError}
          <button type="button" onClick={list.retry}>
            Повторить загрузку
          </button>
        </Notice>
      )}
      {!editing && mutationError && (
        <Notice tone="error">{mutationError}</Notice>
      )}
      {loading ? (
        <p role="status">Загрузка…</p>
      ) : (
        data && (
          <>
            <StorageLocationsTable
              rows={data.items}
              canManage={canManage}
              saving={saving}
              sort={sort}
              onToggle={toggle}
              onEdit={(item) => {
                setMutationError(null);
                setEditing(item);
              }}
              onSortChange={(value) => {
                setSort(value);
              }}
            />
            {!data.items.length && <p>Места хранения не найдены.</p>}
            <ListLoadMore list={list} disabled={saving || editing !== null} />
          </>
        )
      )}
      {filtersOpen && (
        <StorageLocationsFiltersModal
          active={active}
          onClose={() => setFiltersOpen(false)}
          onApply={(value) => {
            setActive(value);
            setFiltersOpen(false);
          }}
        />
      )}
      {editing && (
        <StorageLocationForm
          item={editing === "new" ? null : editing}
          saving={saving}
          error={mutationError}
          onClose={() => {
            setMutationError(null);
            setEditing(null);
          }}
          onSave={(values) =>
            mutate(() =>
              editing === "new"
                ? storageLocationsApi.create(values)
                : storageLocationsApi.update(
                    editing.id,
                    Object.fromEntries(
                      Object.entries(values).filter(
                        ([key, value]) =>
                          key !== "isActive" &&
                          key !== "warehouseId" &&
                          value !== editing[key as "code" | "name"],
                      ),
                    ),
                  ),
            )
          }
        />
      )}
    </section>
  );
}
