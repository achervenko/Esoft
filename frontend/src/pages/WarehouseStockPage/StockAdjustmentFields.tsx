import { Paperclip, FileText, X } from "lucide-react";
import { useRef } from "react";
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
}: {
  form: ReturnType<typeof useStockAdjustmentForm>;
  unit: string;
  balanceId: string;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
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
          label={`Фактически на месте, ${unit}`}
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
        <div className="form-field admin-control-field">
          <label
            className="form-field-label"
            htmlFor={`adjustment-file-${balanceId}`}
          >
            <span>Документ</span>
            <RequiredMark />
          </label>
          <input
            ref={fileInput}
            hidden
            id={`adjustment-file-${balanceId}`}
            type="file"
            aria-required="true"
            accept=".pdf,.jpg,.jpeg,.png,.webp"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (!file) return;
              await form.uploadDocument(file);
            }}
          />
          <div className="stock-adjust-upload">
            <button
              type="button"
              className="admin-secondary-button stock-adjust-upload-button"
              onClick={() => fileInput.current?.click()}
            >
              <Paperclip size={17} aria-hidden="true" />
              {attachment ? "Заменить документ" : "Прикрепить документ"}
            </button>
            <small>PDF, JPEG, PNG или WebP</small>
          </div>
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
