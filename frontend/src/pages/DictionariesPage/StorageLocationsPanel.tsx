import { NestedDictionarySections } from "../../shared/ui/NestedDictionarySections";
import { warehousesApi, type Warehouse } from "../../shared/api/warehouses-api";
import { WarehouseForm } from "./WarehouseForm";
import { WarehousesTable } from "./WarehousesTable";
import { StorageLocationForm } from "./StorageLocationForm";
import {
  StorageLocationsTable,
  type StorageLocationsSort,
} from "./StorageLocationsTable";
import { SearchToolbar } from "../../shared/ui/SearchToolbar";
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
  const [warehouseId, setWarehouseId] = useState<string | null>(null);
  const [warehouseEditing, setWarehouseEditing] = useState<
    Warehouse | "new" | null
  >(null);
  const [sort, setSort] = useState<StorageLocationsSort>({
    key: "name",
    direction: "asc",
  });
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const [editing, setEditing] = useState<StorageLocation | "new" | null>(null);
  const [saving, setSaving] = useState(false);
  const busy = useRef(false);
  const confirm = useConfirmation();
  const warehouseList = useIncrementalList({
    queryKey: JSON.stringify([revision, search]),
    enabled: true,
    getKey: (row: Warehouse) => row.id,
    loadPage: (offset, signal) =>
      warehousesApi.list(
        new URLSearchParams({
          page: String(Math.floor(offset / 50) + 1),
          limit: "50",
          search,
          isActive: "true",
        }),
        signal,
      ),
  });
  const selectedWarehouse = warehouseList.data?.items.find(
    (row) => row.id === warehouseId,
  );
  const list = useIncrementalList({
    keepPreviousData: true,
    queryKey: JSON.stringify([search, sort, revision, warehouseId]),
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
      q.set("isActive", "true");
      if (warehouseId) q.set("warehouseId", warehouseId);
      return storageLocationsApi.list(q, signal);
    },
  });
  const data = list.data;
  const loading = list.loading && !data;
  const loadError = list.isPreviousData || !data ? list.error : null;
  async function mutate(action: () => Promise<unknown>) {
    if (busy.current) return;
    busy.current = true;
    setSaving(true);
    setMutationError(null);
    try {
      await action();
      setEditing(null);
      setWarehouseEditing(null);
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
  async function deleteLocation(item: StorageLocation) {
    if (busy.current) return;
    if (item.isActive) {
      busy.current = true;
      setSaving(true);
      setMutationError(null);
      let confirmed = false;
      try {
        const current = await storageLocationsApi.get(item.id);
        confirmed = await confirm({
          title: "Удалить место хранения?",
          description: current.hasStock
            ? "На месте есть остаток. Он и история сохранятся, обычные новые операции будут недоступны."
            : "Место станет недоступно для обычных новых операций. История сохранится.",
          confirmLabel: "Удалить",
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
      storageLocationsApi.update(item.id, { isActive: false }),
    );
  }
  async function deleteWarehouse(item: Warehouse) {
    if (busy.current) return;
    if (item.isActive) {
      busy.current = true;
      setSaving(true);
      setMutationError(null);
      let accepted = false;
      try {
        accepted = await confirm({
          title: "Удалить склад?",
          description:
            "Склад будет скрыт из справочника. Сначала удалите его места хранения. История сохранится.",
          confirmLabel: "Удалить",
        });
      } catch (e) {
        setMutationError(getApiErrorMessage(e));
      } finally {
        busy.current = false;
        setSaving(false);
      }
      if (!accepted) return;
    }
    const removed = await mutate(() =>
      warehousesApi.update(item.id, { isActive: false }),
    );
    if (removed && warehouseId === item.id) setWarehouseId(null);
  }
  return (
    <section
      className="storage-locations-panel dictionaries-content"
      aria-label="Места хранения"
    >
      <SearchToolbar
        value={search}
        onChange={(value) => {
          setSearch(value);
          setWarehouseId(null);
        }}
        label="Поиск складов и мест хранения"
        inputProps={{ maxLength: 255 }}
        onCreate={
          canManage
            ? () => {
                setMutationError(null);
                setWarehouseEditing("new");
              }
            : undefined
        }
        createAriaLabel="Добавить склад"
        createDisabled={saving}
      />
      <NestedDictionarySections
        parentTitle="Склады"
        childTitle="Места хранения"
        childCreateLabel="Добавить место"
        onCreateChild={
          canManage
            ? () => {
                setMutationError(null);
                setEditing("new");
              }
            : undefined
        }
        childCreateDisabled={
          saving ||
          warehouseList.loading ||
          (!search &&
            !warehouseList.error &&
            !warehouseList.data?.items.some((row) => row.isActive)) ||
          !!(selectedWarehouse && !selectedWarehouse.isActive)
        }
        parent={
          <>
            {warehouseList.error && (
              <Notice tone="error">
                {warehouseList.error}
                <button
                  type="button"
                  className="admin-secondary-button"
                  onClick={warehouseList.retry}
                >
                  Повторить загрузку складов
                </button>
              </Notice>
            )}
            {warehouseList.loading && !warehouseList.data ? (
              <p role="status">Загрузка складов…</p>
            ) : (
              <>
                <WarehousesTable
                  rows={warehouseList.data?.items ?? []}
                  canManage={canManage}
                  saving={saving}
                  selectedId={warehouseId}
                  onSelect={(row) =>
                    setWarehouseId(row.id === warehouseId ? null : row.id)
                  }
                  onEdit={(row) => {
                    setMutationError(null);
                    setWarehouseEditing(row);
                  }}
                  onDelete={deleteWarehouse}
                />
                <ListLoadMore
                  list={warehouseList}
                  disabled={saving || warehouseEditing !== null}
                />
              </>
            )}
          </>
        }
      >
        {loadError && (
          <Notice tone="error">
            {loadError}
            <button type="button" onClick={list.retry}>
              Повторить загрузку
            </button>
          </Notice>
        )}
        {!editing && !warehouseEditing && mutationError && (
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
                saving={saving || list.isPreviousData}
                sort={sort}
                onDelete={deleteLocation}
                onEdit={(item) => {
                  setMutationError(null);
                  setEditing(item);
                }}
                onSortChange={(value) => {
                  setSort(value);
                }}
              />
              {!list.isPreviousData && (
                <ListLoadMore
                  list={list}
                  disabled={saving || editing !== null}
                />
              )}
            </>
          )
        )}
      </NestedDictionarySections>
      {editing && (
        <StorageLocationForm
          initialWarehouseId={warehouseId}
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
                          value !== editing[key as "name"],
                      ),
                    ),
                  ),
            )
          }
        />
      )}
      {warehouseEditing && (
        <WarehouseForm
          item={warehouseEditing === "new" ? null : warehouseEditing}
          saving={saving}
          error={mutationError}
          onClose={() => {
            setWarehouseEditing(null);
            setMutationError(null);
          }}
          onSave={(values) =>
            mutate(() =>
              warehouseEditing === "new"
                ? warehousesApi.create(values)
                : warehousesApi.update(warehouseEditing.id, values),
            )
          }
        />
      )}
    </section>
  );
}
