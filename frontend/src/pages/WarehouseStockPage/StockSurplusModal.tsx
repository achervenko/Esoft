import { useState } from "react";
import type { WarehouseItem } from "../../shared/api/warehouse-catalog-api";
import { AdminModal } from "../../shared/ui/AdminModal";
import { Notice } from "../../shared/ui/Notice";
import { SelectField } from "../../shared/ui/SelectField";
import { ReceiptItemPicker } from "../../shared/warehouse/ReceiptItemPicker";
import { useStorageChoices } from "../../shared/warehouse/useStorageChoices";
import { StockAdjustmentFields } from "./StockAdjustmentFields";
import { useStockAdjustmentForm } from "./useStockAdjustmentForm";
import "./StockAdjustmentForm.css";

export function StockSurplusModal({
  actorId,
  onClose,
  onSaved,
}: {
  actorId?: string | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [warehouseId, setWarehouseId] = useState("");
  const [locationId, setLocationId] = useState("");
  const [item, setItem] = useState<WarehouseItem | null>(null);
  const choices = useStorageChoices(true, warehouseId, true);
  const form = useStockAdjustmentForm({
    actorId,
    itemId: item?.id ?? "",
    locationId,
    onSaved,
  });
  const { locked, pending, saving, uploading } = form;
  return (
    <AdminModal
      title="Добавить остаток"
      onClose={onClose}
      isCloseDisabled={locked}
    >
      <form className="admin-form" onSubmit={form.submit}>
        {pending && !item ? (
          <p>
            Номенклатура №{pending.itemId}, место хранения №{pending.locationId}
          </p>
        ) : (
          <fieldset className="stock-adjust-fields" disabled={locked}>
            <ReceiptItemPicker value={item} onChange={setItem} />
            <SelectField
              label="Склад"
              required
              searchable
              value={warehouseId}
              onChange={(id) => {
                setWarehouseId(id);
                setLocationId("");
              }}
              options={choices.warehouses.map((warehouse) => ({
                value: warehouse.id,
                label: warehouse.name,
              }))}
            />
            <SelectField
              label="Место хранения"
              required
              searchable
              disabled={!warehouseId || choices.loading || !!choices.error}
              value={locationId}
              onChange={setLocationId}
              options={choices.locations.map((location) => ({
                value: location.id,
                label: location.name,
              }))}
            />
          </fieldset>
        )}
        {choices.error && !pending && (
          <Notice tone="error">
            {choices.error}
            <button type="button" onClick={choices.retry}>
              Повторить загрузку мест
            </button>
          </Notice>
        )}
        <StockAdjustmentFields
          form={form}
          unit={item?.unit ?? ""}
          quantityLabel="Количество"
        />
        {form.error && <Notice tone="error">{form.error}</Notice>}
        {pending && !saving && (
          <Notice>
            Результат запроса не подтверждён. Повторите сохранение с теми же
            данными.
          </Notice>
        )}
        <div className="admin-form-actions">
          <button
            type="button"
            className="admin-secondary-button"
            disabled={locked}
            onClick={onClose}
          >
            Отмена
          </button>
          <button
            type="submit"
            className="admin-primary-button"
            disabled={saving || uploading || !form.canSubmit}
          >
            {saving
              ? "Сохранение…"
              : pending
                ? "Повторить сохранение"
                : "Сохранить"}
          </button>
        </div>
      </form>
    </AdminModal>
  );
}
