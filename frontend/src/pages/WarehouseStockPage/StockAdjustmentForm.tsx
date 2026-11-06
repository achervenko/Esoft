import "./StockAdjustmentForm.css";
import { Notice } from "../../shared/ui/Notice";
import {
  useStockAdjustmentForm,
  type StockAdjustmentFormProps,
} from "./useStockAdjustmentForm";
import { StockAdjustmentFields } from "./StockAdjustmentFields";
import {
  StockAdjustmentSummary,
  StockAdjustmentPreview,
} from "./StockAdjustmentPreview";
export function StockAdjustmentForm(props: StockAdjustmentFormProps) {
  const { data, balance, onClose, onSaved } = props;
  const form = useStockAdjustmentForm(props);
  const {
    error,
    locked,
    pending,
    saving,
    uploading,
    amount,
    delta,
    reason,
    attachment,
  } = form;
  return (
    <form className="admin-form" onSubmit={form.submit}>
      <StockAdjustmentSummary data={data} balance={balance} />
      <StockAdjustmentFields
        form={form}
        unit={data.item.unit}
        balanceId={balance.balanceId}
      />
      <StockAdjustmentPreview
        data={data}
        balance={balance}
        amount={amount}
        delta={delta}
      />
      {error && (
        <Notice tone="error">
          {error}
          {!locked && (
            <button
              type="button"
              className="admin-secondary-button"
              onClick={onSaved}
            >
              Обновить остаток
            </button>
          )}
        </Notice>
      )}
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
          disabled={
            saving ||
            uploading ||
            (!pending &&
              (amount === null ||
                delta === 0n ||
                !reason.trim() ||
                !attachment))
          }
        >
          {saving
            ? "Сохранение…"
            : pending
              ? "Повторить сохранение"
              : "Сохранить"}
        </button>
      </div>
    </form>
  );
}
