import { AdminModal } from "../../shared/ui/AdminModal";
import { Notice } from "../../shared/ui/Notice";
import type { StockDistribution } from "../../shared/api/warehouse-stock-api";
import {
  StockTransferProduct,
  StockTransferPreview,
} from "./StockTransferPreview";
import { StockTransferFields } from "./StockTransferFields";
import { useStockTransferForm } from "./useStockTransferForm";
import "./StockTransferForm.css";

export function StockTransferForm({
  data,
  source,
  reservation,
  onClose,
  onSaved,
  embedded = false,
  onSavingChange,
}: {
  data: StockDistribution;
  source: StockDistribution["locations"][number];
  reservation?: StockDistribution["locations"][number]["reservations"][number];
  onClose: () => void;
  onSaved: () => void;
  embedded?: boolean;
  onSavingChange?: (saving: boolean) => void;
}) {
  const state = useStockTransferForm({
    data,
    source,
    reservation,
    onSaved,
    onSavingChange,
  });
  const {
    submit,
    saving,
    error,
    pending,
    locked,
    choices,
    locationId,
    warehouseId,
    amount,
    valid,
  } = state;
  const form = (
    <form className="admin-form" onSubmit={(e) => void submit(e)}>
      <StockTransferProduct data={data} />
      {reservation && (
        <p className="stock-transfer-hint">
          Резерв · {reservation.projectNumber}
          {reservation.projectName ? ` · ${reservation.projectName}` : ""}. При
          перемещении резерв сохраняется за этим проектом.
        </p>
      )}
      <StockTransferFields
        data={data}
        source={source}
        reservation={reservation}
        form={state}
      />
      <StockTransferPreview
        reserved={!!reservation}
        data={data}
        source={{
          ...source,
          quantity:
            reservation?.movableQuantity ??
            reservation?.quantity ??
            source.available,
        }}
        destination={
          locationId
            ? {
                warehouse:
                  choices.warehouses.find((w) => w.id === warehouseId)?.name ??
                  "",
                location:
                  choices.locations.find((l) => l.id === locationId)?.name ??
                  "",
              }
            : undefined
        }
        amount={amount}
        valid={valid}
      />
      {error && <Notice tone="error">{error}</Notice>}
      {pending && !saving && (
        <Notice>
          Результат пока не подтверждён. Повторите запрос: уже проведённое
          перемещение не выполнится второй раз.
        </Notice>
      )}
      <div className="admin-form-actions">
        <button
          className="admin-secondary-button"
          type="button"
          disabled={locked}
          onClick={onClose}
        >
          Отмена
        </button>
        <button
          className="admin-primary-button"
          type="submit"
          disabled={
            saving ||
            (!pending && (!valid || choices.loading || !!choices.error))
          }
        >
          {saving
            ? "Перемещение…"
            : pending
              ? "Повторить перемещение"
              : "Переместить"}
        </button>
      </div>
    </form>
  );
  return embedded ? (
    form
  ) : (
    <AdminModal
      title="Переместить остаток"
      className="stock-transfer-modal"
      onClose={onClose}
      isCloseDisabled={locked}
    >
      {form}
    </AdminModal>
  );
}
