import { useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { AdminModal } from "../../shared/ui/AdminModal";
import {
  AdminTextField,
  AdminTextareaField,
} from "../../shared/ui/AdminFormControls";
import { SelectField } from "../../shared/ui/SelectField";
import { Notice } from "../../shared/ui/Notice";
import { getApiErrorMessage } from "../../shared/api/api-error";
import {
  warehouseStockApi,
  type StockDistribution,
  type StockTransferInput,
} from "../../shared/api/warehouse-stock-api";
import { useStorageChoices } from "./useStorageChoices";
import {
  StockTransferProduct,
  StockTransferPreview,
} from "./StockTransferPreview";
import "./StockTransferForm.css";
import {
  formatStockQuantity,
  quantityMillis,
  transferRequestKey,
} from "./stock-page.utils";
export function StockTransferForm({
  data,
  source,
  onClose,
  onSaved,
  embedded = false,
  onSavingChange,
}: {
  data: StockDistribution;
  source: StockDistribution["locations"][number];
  onClose: () => void;
  onSaved: () => void;
  embedded?: boolean;
  onSavingChange?: (saving: boolean) => void;
}) {
  const [warehouseId, setWarehouseId] = useState(data.warehouse.id),
    [locationId, setLocationId] = useState("");
  const [quantity, setQuantity] = useState(""),
    [comment, setComment] = useState("");
  const [commentOpen, setCommentOpen] = useState(false);
  const [saving, setSaving] = useState(false),
    [error, setError] = useState<string | null>(null);
  const busy = useRef(false),
    lastRequest = useRef<{
      fingerprint: string;
      input: StockTransferInput;
    } | null>(null);
  const choices = useStorageChoices(true, warehouseId, true);
  const warehouseOptions =
    choices.loading && !choices.warehouses.length
      ? [data.warehouse]
      : choices.warehouses;
  const normalized = quantity.trim().replace(",", ".");
  const amount = quantityMillis(normalized),
    available = quantityMillis(source.available);
  let quantityError: string | undefined;
  if (normalized) {
    if (/^-\d+(\.\d+)?$/.test(normalized))
      quantityError = "Количество не может быть отрицательным.";
    else if (/^\d+\.\d{4,}$/.test(normalized))
      quantityError = "Допустимо не более трёх знаков после запятой.";
    else if (amount === null) quantityError = "Введите корректное количество.";
    else if (amount === 0n)
      quantityError = "Количество должно быть больше нуля.";
    else if (available === null)
      quantityError = "Не удалось определить доступный остаток.";
    else if (amount > available)
      quantityError = `Нельзя переместить больше доступного остатка: ${formatStockQuantity(source.available)} ${data.item.unit}.`;
  }
  const valid =
    amount !== null &&
    amount > 0n &&
    available !== null &&
    amount <= available &&
    !!locationId &&
    locationId !== source.location.id;
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy.current || !valid || choices.loading || choices.error) return;
    busy.current = true;
    setSaving(true);
    onSavingChange?.(true);
    setError(null);
    try {
      const payload = {
        itemId: data.item.id,
        fromLocationId: source.location.id,
        toLocationId: locationId,
        quantity: normalized,
        comment: comment.trim(),
      };
      const fingerprint = JSON.stringify(payload);
      if (lastRequest.current?.fingerprint !== fingerprint)
        lastRequest.current = {
          fingerprint,
          input: { ...payload, requestKey: transferRequestKey() },
        };
      await warehouseStockApi.transfer(lastRequest.current.input);
      onSaved();
    } catch (e) {
      setError(getApiErrorMessage(e));
    } finally {
      busy.current = false;
      setSaving(false);
      onSavingChange?.(false);
    }
  }
  const form = (
    <form className="admin-form" onSubmit={(e) => void submit(e)}>
      <StockTransferProduct data={data} />
      <div className="stock-transfer-grid">
        <section
          className="stock-transfer-section stock-transfer-source"
          aria-label="Откуда"
        >
          <h3>Откуда</h3>
          <AdminTextField
            label="Склад отправления"
            value={data.warehouse.name}
            readOnly
            onChange={() => {}}
          />
          <AdminTextField
            label="Место отправления"
            value={source.location.name}
            readOnly
            onChange={() => {}}
          />
        </section>
        <section className="stock-transfer-section" aria-label="Куда">
          <h3>Куда</h3>
          <SelectField
            label="Склад назначения"
            value={warehouseId}
            onChange={(id) => {
              setWarehouseId(id);
              setLocationId("");
            }}
            searchable
            disabled={saving || choices.loading}
            options={warehouseOptions.map((w) => ({
              value: w.id,
              label: w.name,
            }))}
          />
          <SelectField
            label="Место назначения"
            value={locationId}
            onChange={setLocationId}
            searchable
            required
            disabled={saving || choices.loading}
            options={choices.locations
              .filter((l) => l.id !== source.location.id)
              .map((l) => ({ value: l.id, label: l.name }))}
            placeholder=""
          />
        </section>
      </div>
      {choices.error && (
        <Notice tone="error">
          {choices.error}
          <button type="button" onClick={choices.retry}>
            Повторить загрузку
          </button>
        </Notice>
      )}
      <section className="stock-transfer-section">
        <div className="stock-transfer-quantity">
          <AdminTextField
            label="Количество"
            value={quantity}
            onChange={setQuantity}
            inputMode="decimal"
            required
            maxLength={15}
            disabled={saving}
            error={quantityError}
          />
          <span className="stock-transfer-unit">{data.item.unit}</span>
        </div>
        <p className="stock-transfer-hint">
          Доступно для перемещения:{" "}
          <strong>
            {formatStockQuantity(source.available)} {data.item.unit}
          </strong>
        </p>
      </section>
      <button
        type="button"
        className="stock-transfer-comment-toggle"
        aria-expanded={commentOpen}
        aria-controls="stock-transfer-comment"
        disabled={saving}
        onClick={() => setCommentOpen((open) => !open)}
      >
        {commentOpen
          ? "Скрыть комментарий"
          : comment
            ? "Изменить комментарий"
            : "Добавить комментарий"}
        <ChevronDown
          size={16}
          aria-hidden="true"
          className="stock-transfer-comment-chevron"
        />
      </button>
      {commentOpen && (
        <section id="stock-transfer-comment" className="stock-transfer-section">
          <AdminTextareaField
            label="Комментарий"
            value={comment}
            onChange={setComment}
            maxLength={4000}
            disabled={saving}
          />
        </section>
      )}
      <StockTransferPreview
        data={data}
        source={source}
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
      <div className="admin-form-actions">
        <button
          className="admin-secondary-button"
          type="button"
          disabled={saving}
          onClick={onClose}
        >
          Отмена
        </button>
        <button
          className="admin-primary-button"
          type="submit"
          disabled={saving || !valid || choices.loading || !!choices.error}
        >
          {saving ? "Перемещение…" : "Переместить"}
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
      isCloseDisabled={saving}
    >
      {form}
    </AdminModal>
  );
}
