import { AdminModal } from "../../shared/ui/AdminModal";
import { Notice } from "../../shared/ui/Notice";
import { TextField, TextareaField } from "../../shared/ui/TextField";
import { SelectField } from "../../shared/ui/SelectField";
import { ReceiptItemPicker } from "../../shared/warehouse/ReceiptItemPicker";
import { WarehouseItemIdentity } from "../../shared/warehouse/WarehouseItemIdentity";
import { useReservationPlaces } from "./useReservationPlaces";
import { formatStockQuantity } from "../../shared/lib/warehouse-quantity";
import { useReservationOperation } from "./useReservationOperation";
import {
  operationTitles,
  type ReservationOperation,
} from "./reservation-operation";

export function ReservationOperationForm({
  operation,
  orderId,
  onClose,
  onSaved,
  onRefresh,
}: {
  operation: ReservationOperation;
  orderId: string;
  onClose: () => void;
  onSaved: () => void;
  onRefresh: () => void;
}) {
  const form = useReservationOperation(operation, orderId, onSaved);
  const selectedItemId =
    operation.kind === "reserve"
      ? (form.item?.id ?? "")
      : (form.r?.item.id ?? "");
  const choices = useReservationPlaces(
    selectedItemId,
    operation.kind === "reserve" || operation.kind === "restore",
  );
  const places = choices.locations;
  const needsPlace =
    operation.kind === "reserve" || operation.kind === "restore";
  return (
    <AdminModal
      title={operationTitles[operation.kind]}
      onClose={onClose}
      isCloseDisabled={form.saving}
    >
      <form
        className="admin-form reservation-operation-form"
        onSubmit={form.submit}
      >
        {form.r && (
          <WarehouseItemIdentity
            name={form.r.item.name}
            article={form.r.item.article}
          />
        )}
        {form.source && (
          <p>
            Откуда: {form.source.location.warehouse.name} —{" "}
            {form.source.location.name} (
            {formatStockQuantity(form.source.quantity)} {form.r?.item.unit})
          </p>
        )}
        <fieldset disabled={form.locked}>
          {operation.kind === "reserve" && (
            <ReceiptItemPicker
              value={form.item}
              onChange={(item) => {
                form.setItem(item);
                form.setLocationId("");
              }}
            />
          )}
          {needsPlace && (
            <SelectField
              label={"Место хранения"}
              required
              searchable
              value={form.locationId}
              onChange={form.setLocationId}
              disabled={!selectedItemId || choices.loading || !!choices.error}
              options={places.map((l) => ({
                value: l.id,
                label: `${l.warehouse.name} — ${l.name}`,
              }))}
            />
          )}
          {needsPlace &&
            selectedItemId &&
            !choices.loading &&
            !choices.error &&
            !places.length && (
              <Notice>
                У этой номенклатуры нет остатков в активных местах хранения.
              </Notice>
            )}
          {operation.kind === "decrease" ? (
            <>
              {form.r?.allocations.map((a) => (
                <TextField
                  key={a.id}
                  label={`${a.location.warehouse.name} — ${a.location.name} (до ${formatStockQuantity(a.quantity)} ${form.r?.item.unit})`}
                  inputMode="decimal"
                  value={form.allocations[a.location.id] ?? ""}
                  onChange={(value) =>
                    form.setAllocations((previous) => ({
                      ...previous,
                      [a.location.id]: value,
                    }))
                  }
                />
              ))}
              {form.r?.deficitQuantity !== "0" && (
                <TextField
                  label={`Снять из дефицита (до ${formatStockQuantity(form.r?.deficitQuantity ?? "0")})`}
                  inputMode="decimal"
                  value={form.deficitQuantity}
                  onChange={form.setDeficitQuantity}
                />
              )}
              <Notice>
                Потребность уменьшится на {form.decreasePreview}{" "}
                {form.r?.item.unit}. Указанные количества будут освобождены с
                выбранных мест.
              </Notice>
            </>
          ) : (
            <TextField
              label={`Количество${form.r ? `, ${form.r.item.unit}` : form.item ? `, ${form.item.unit}` : ""}`}
              required
              inputMode="decimal"
              value={form.quantity}
              onChange={form.setQuantity}
            />
          )}
          <TextareaField
            label="Комментарий"
            required={operation.kind !== "reserve"}
            maxLength={4000}
            value={form.comment}
            onChange={form.setComment}
          />
        </fieldset>
        {choices.error && needsPlace && (
          <Notice tone="error">
            {choices.error}
            <button type="button" onClick={choices.retry}>
              Повторить загрузку мест
            </button>
          </Notice>
        )}
        {form.error && <Notice tone="error">{form.error}</Notice>}
        {form.uncertain && (
          <Notice>
            Ответ не получен. Операция могла выполниться. Получите актуальные
            данные перед дальнейшими действиями; повторная отправка
            заблокирована.
          </Notice>
        )}
        {form.error && !form.saving && (
          <button
            type="button"
            className="admin-secondary-button"
            onClick={onRefresh}
          >
            Обновить данные резервов
          </button>
        )}
        <div className="admin-form-actions">
          <button
            type="button"
            className="admin-secondary-button"
            disabled={form.saving}
            onClick={onClose}
          >
            Отмена
          </button>
          <button
            type="submit"
            className="admin-primary-button"
            disabled={
              form.saving ||
              form.uncertain ||
              !form.valid ||
              (needsPlace && (choices.loading || !!choices.error))
            }
          >
            {form.saving ? "Сохранение…" : "Сохранить"}
          </button>
        </div>
      </form>
    </AdminModal>
  );
}
