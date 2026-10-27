import { SelectField } from "../../shared/ui/SelectField";
import { warehousesApi, type Warehouse } from "../../shared/api/warehouses-api";
import { getApiErrorMessage } from "../../shared/api/api-error";
import { useEffect, useState } from "react";
import type { StorageLocation } from "../../shared/api/storage-locations-api";
import { AdminModal } from "../../shared/ui/AdminModal";
import { Notice } from "../../shared/ui/Notice";
import {
  AdminTextField,
  AdminFormActions,
} from "../../shared/ui/AdminFormControls";

export function StorageLocationForm({
  item,
  saving,
  error,
  onClose,
  onSave,
}: {
  item: StorageLocation | null;
  saving: boolean;
  error: string | null;
  onClose: () => void;
  onSave: (v: {
    warehouseId: string;
    code: string;
    name: string;
    isActive: boolean;
  }) => Promise<unknown>;
}) {
  const [code, setCode] = useState(item?.code ?? "");
  const [name, setName] = useState(item?.name ?? "");
  const [warehouseId, setWarehouseId] = useState(item?.warehouseId ?? "");
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
            code.trim() &&
            name.trim()
          )
            void onSave({
              warehouseId,
              code: code.trim(),
              name: name.trim(),
              isActive: item?.isActive ?? true,
            });
        }}
      >
        {item ? (
          <p>
            Склад: {item.warehouse.name} ({item.warehouse.code})
          </p>
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
                label: row.name + " (" + row.code + ")",
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
          label="Код"
          autoFocus
          required
          maxLength={100}
          value={code}
          disabled={saving}
          onChange={setCode}
        />
        <AdminTextField
          label="Наименование"
          required
          maxLength={255}
          value={name}
          disabled={saving}
          onChange={setName}
        />
        {error && <Notice tone="error">{error}</Notice>}
        <AdminFormActions
          isSaving={saving}
          onClose={onClose}
          submitDisabled={
            !warehouseId ||
            loadingWarehouses ||
            !!warehouseError ||
            !code.trim() ||
            !name.trim() ||
            !!(item && code.trim() === item.code && name.trim() === item.name)
          }
        />
      </form>
    </AdminModal>
  );
}
