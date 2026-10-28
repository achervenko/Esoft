import { SelectField } from "../../shared/ui/SelectField";
import { warehousesApi, type Warehouse } from "../../shared/api/warehouses-api";
import { getApiErrorMessage } from "../../shared/api/api-error";
import { useEffect, useState } from "react";
import type { StorageLocation } from "../../shared/api/storage-locations-api";
import { AdminModal } from "../../shared/ui/AdminModal";
import { Notice } from "../../shared/ui/Notice";
import {
  AdminFormActions,
  AdminTextField,
} from "../../shared/ui/AdminFormControls";

export function StorageLocationForm({
  item,
  saving,
  error,
  onClose,
  onSave,
  initialWarehouseId,
}: {
  initialWarehouseId?: string | null;
  item: StorageLocation | null;
  saving: boolean;
  error: string | null;
  onClose: () => void;
  onSave: (v: {
    warehouseId: string;
    name: string;
    isActive: boolean;
  }) => Promise<unknown>;
}) {
  const [name, setName] = useState(item?.name ?? "");
  const [warehouseId, setWarehouseId] = useState(
    item?.warehouseId ?? initialWarehouseId ?? "",
  );
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loadingWarehouses, setLoadingWarehouses] = useState(!item);
  const [warehouseError, setWarehouseError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (item) return;
    const controller = new AbortController();
    setLoadingWarehouses(true);
    setWarehouseError(null);
    async function load() {
      const rows: Warehouse[] = [];
      for (let page = 1; ; page++) {
        const result = await warehousesApi.list(
          new URLSearchParams({
            isActive: "true",
            page: String(page),
            limit: "100",
          }),
          controller.signal,
        );
        rows.push(...result.items);
        if (rows.length >= result.total || !result.items.length) break;
      }
      if (controller.signal.aborted) return;
      setWarehouses(rows);
      setWarehouseId((current) =>
        rows.some((row) => row.id === current)
          ? current
          : rows.length === 1
            ? rows[0].id
            : "",
      );
    }
    void load()
      .catch((error) => {
        if (!controller.signal.aborted)
          setWarehouseError(getApiErrorMessage(error));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadingWarehouses(false);
      });
    return () => controller.abort();
  }, [item, retry]);
  return (
    <AdminModal
      title={item ? "Изменить место хранения" : "Новое место хранения"}
      onClose={onClose}
      isCloseDisabled={saving}
    >
      <form
        className="admin-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (
            !saving &&
            !loadingWarehouses &&
            !warehouseError &&
            warehouseId &&
            name.trim()
          )
            void onSave({
              warehouseId,
              name: name.trim(),
              isActive: item?.isActive ?? true,
            });
        }}
      >
        {item ? (
          <p>Склад: {item.warehouse.name}</p>
        ) : (
          <>
            <SelectField
              label="Склад"
              required
              value={warehouseId}
              onChange={setWarehouseId}
              disabled={saving || loadingWarehouses}
              searchable
              placeholder={
                loadingWarehouses ? "Загрузка складов…" : "Выберите склад"
              }
              options={warehouses.map((row) => ({
                value: row.id,
                label: row.name,
              }))}
            />
            {warehouseError && (
              <Notice tone="error">
                {warehouseError}
                <button type="button" onClick={() => setRetry((v) => v + 1)}>
                  Повторить загрузку складов
                </button>
              </Notice>
            )}
            {!loadingWarehouses && !warehouseError && !warehouses.length && (
              <Notice>Нет активных складов. Сначала создайте склад.</Notice>
            )}
          </>
        )}
        <AdminTextField
          label="Наименование"
          value={name}
          onChange={setName}
          disabled={saving}
          required
          maxLength={255}
          autoFocus
        />
        {error && <Notice tone="error">{error}</Notice>}
        <AdminFormActions
          isSaving={saving}
          onClose={onClose}
          submitDisabled={
            !warehouseId ||
            loadingWarehouses ||
            !!warehouseError ||
            !name.trim() ||
            !!(item && name.trim() === item.name)
          }
        />
      </form>
    </AdminModal>
  );
}
