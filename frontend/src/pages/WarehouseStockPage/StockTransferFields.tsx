import { ChevronDown } from "lucide-react";
import {
  AdminTextField,
  AdminTextareaField,
} from "../../shared/ui/AdminFormControls";
import { SelectField } from "../../shared/ui/SelectField";
import { Notice } from "../../shared/ui/Notice";
import { formatStockQuantity } from "./stock-page.utils";
import type { useStockTransferForm } from "./useStockTransferForm";

export function StockTransferFields({
  data,
  source,
  form,
}: Pick<Parameters<typeof useStockTransferForm>[0], "data" | "source"> & {
  form: ReturnType<typeof useStockTransferForm>;
}) {
  const {
    warehouseId,
    setWarehouseId,
    locationId,
    setLocationId,
    quantity,
    setQuantity,
    comment,
    setComment,
    commentOpen,
    setCommentOpen,
    locked,
    choices,
    warehouseOptions,
    quantityError,
    selectedReservation,
    availableQuantity,
  } = form;
  return (
    <>
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
            disabled={locked || choices.loading}
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
            disabled={locked || choices.loading}
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
            disabled={locked}
            error={quantityError}
          />
          <span className="stock-transfer-unit">{data.item.unit}</span>
        </div>
        <p className="stock-transfer-hint">
          Доступно для перемещения:{" "}
          <strong>
            {formatStockQuantity(availableQuantity)} {data.item.unit}
          </strong>
        </p>
      </section>
      {selectedReservation && (
        <p className="stock-transfer-hint">
          Резерв заказа №{selectedReservation.order.number}
          {selectedReservation.order.name
            ? ` — ${selectedReservation.order.name}`
            : ""}
        </p>
      )}
      <button
        type="button"
        className="stock-transfer-comment-toggle"
        aria-expanded={commentOpen}
        aria-controls="stock-transfer-comment"
        disabled={locked}
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
            disabled={locked}
          />
        </section>
      )}
    </>
  );
}
