import { StockTransferProduct } from "./StockTransferPreview";
import "./StockAdjustmentForm.css";
import { Notice } from "../../shared/ui/Notice";
import { formatStockQuantity } from "./stock-page.utils";
import {
  useStockReservationOperation,
  type StockReservationOperationProps,
} from "./useStockReservationOperation";
import { StockReservationOperationFields } from "./StockReservationOperationFields";
import { StockReservationOperationDocument } from "./StockReservationOperationDocument";
export function StockReservationOperationForm(
  props: StockReservationOperationProps,
) {
  const { data, onSaved, onClose } = props;
  const form = useStockReservationOperation(props);
  const {
    reservation,
    borrowed,
    locked,
    uploading,
    error,
    pending,
    saving,
    valid,
  } = form;
  return (
    <form className="admin-form" onSubmit={form.submit}>
      <StockTransferProduct data={data} />
      <p>
        Резерв:{" "}
        <strong>
          {formatStockQuantity(reservation.quantity)} {data.item.unit}
        </strong>
        {borrowed > 0n && (
          <>
            {" "}
            · Заимствовано: {formatStockQuantity(
              reservation.borrowedQuantity!,
            )}{" "}
            {data.item.unit}
          </>
        )}
      </p>
      <fieldset disabled={locked} className="stock-adjust-fields">
        <StockReservationOperationFields form={form} unit={data.item.unit} />
        <StockReservationOperationDocument form={form} />
      </fieldset>
      {uploading && <p role="status">Загрузка документа…</p>}
      {error && (
        <Notice tone="error">
          {error}
          {!locked && (
            <button
              type="button"
              className="admin-secondary-button"
              onClick={onSaved}
            >
              Обновить данные
            </button>
          )}
        </Notice>
      )}
      {pending && !saving && (
        <Notice>
          Результат не подтверждён. Повтор использует исходный запрос.
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
          disabled={saving || uploading || (!pending && !valid)}
        >
          {saving
            ? "Сохранение…"
            : pending
              ? "Повторить операцию"
              : "Сохранить"}
        </button>
      </div>
    </form>
  );
}
