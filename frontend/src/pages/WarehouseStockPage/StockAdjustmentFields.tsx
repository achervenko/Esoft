import { FileText, X } from "lucide-react";
import { FileDropzone } from "../../shared/ui/FileDropzone";
import {
  AdminTextField,
  AdminTextareaField,
} from "../../shared/ui/AdminFormControls";
import { RequiredMark } from "../../shared/ui/RequiredMark";
import { Notice } from "../../shared/ui/Notice";
import type { useStockAdjustmentForm } from "./useStockAdjustmentForm";
export function StockAdjustmentFields({
  form,
  unit,
  balanceId,
  quantityLabel = "Фактически на месте",
}: {
  form: ReturnType<typeof useStockAdjustmentForm>;
  unit: string;
  balanceId: string;
  quantityLabel?: string;
}) {
  const {
    locked,
    quantity,
    setQuantity,
    amount,
    reason,
    setReason,
    attachment,
    setAttachment,
    uploading,
  } = form;
  return (
    <>
      {" "}
      <fieldset className="stock-adjust-fields" disabled={locked}>
        <AdminTextField
          label={`${quantityLabel}, ${unit}`}
          value={quantity}
          onChange={setQuantity}
          inputMode="decimal"
          required
        />
        {quantity && amount === null && (
          <Notice tone="error">
            Введите неотрицательное количество, до трёх знаков после запятой.
          </Notice>
        )}
        <AdminTextareaField
          label="Причина"
          value={reason}
          onChange={setReason}
          maxLength={1000}
          required
        />
        <div
          className="form-field admin-control-field"
          role="group"
          aria-labelledby={`adjustment-file-${balanceId}`}
        >
          <span className="form-field-label">
            <span id={`adjustment-file-${balanceId}`}>Документ</span>
            <RequiredMark />
          </span>
          <FileDropzone
            files={[]}
            onFilesChange={([file]) => {
              if (file) void form.uploadDocument(file);
            }}
            accept=".pdf,.jpg,.jpeg,.png,.webp"
            imageAccept="image/jpeg,image/png,image/webp"
            disabled={locked}
          />
          <small className="stock-adjust-file-hint">
            PDF, JPEG, PNG или WebP
          </small>
          {attachment && (
            <div className="stock-adjust-attachment">
              <FileText size={20} aria-hidden="true" />
              <span title={attachment.originalName}>
                {attachment.originalName}
              </span>
              <button
                type="button"
                className="stock-adjust-remove"
                aria-label="Убрать документ"
                title="Убрать документ"
                onClick={() => setAttachment(null)}
              >
                <X size={18} aria-hidden="true" />
              </button>
            </div>
          )}
        </div>
      </fieldset>
      {uploading && <p role="status">Загрузка документа…</p>}
    </>
  );
}
