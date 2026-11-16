import { useState } from "react";
import type { OrderData } from "../../shared/api/orders-api";
import { SelectField } from "../../shared/ui/SelectField";
import { TextField } from "../../shared/ui/TextField";
import { ReceiptItemPicker } from "../../shared/warehouse/ReceiptItemPicker";
import {
  formatStockQuantity,
  quantityMillis,
} from "../../shared/lib/warehouse-quantity";
import { ReservationOperationModal } from "./ReservationOperationModal";
import { ReservationOrderPicker } from "./ReservationOrderPicker";
import { operationTitles } from "./reservation-operation";
import {
  decimalQuantity,
  useReservationOperation,
} from "./useReservationOperation";
import { useReservationPlaces } from "./useReservationPlaces";
import type { ReservationOperationFormProps } from "./ReservationOperationForm";

export function ReservationCreateForm({
  operation,
  orderId,
  actorId,
  onClose,
  onSaved,
  onRefresh,
}: ReservationOperationFormProps) {
  const [order, setOrder] = useState<OrderData | null>(null);
  const form = useReservationOperation(
    operation,
    orderId ?? order?.id ?? "",
    onSaved,
    actorId,
  );
  const selectedItemId = form.item?.id ?? "";
  const choices = useReservationPlaces(selectedItemId, true);
  const requiredAmount = form.amount ?? 0n;
  const showPlace = !!selectedItemId && requiredAmount > 0n;
  const reserveLocation =
    !choices.loading && !choices.error
      ? choices.locations.find((place) => place.id === form.locationId)
      : undefined;
  const reserveStock = reserveLocation
    ? (quantityMillis(choices.free?.[reserveLocation.id] ?? "0") ?? 0n)
    : 0n;
  const fullyCovered =
    !!reserveLocation && requiredAmount > 0n && reserveStock >= requiredAmount;
  const reservePlaceUnavailable = !!form.locationId && !reserveLocation;
  const reservePlaceMissing =
    reservePlaceUnavailable && !choices.loading && !choices.error;
  const displayQuantity = (quantity: bigint) =>
    `${formatStockQuantity(decimalQuantity(quantity))} ${form.item?.unit ?? ""}`;
  const placeError =
    choices.error ??
    (reservePlaceMissing
      ? "Выбранного места больше нет в остатках. Повторите загрузку или очистите место."
      : null);

  return (
    <ReservationOperationModal
      title={operationTitles.reserve}
      form={form}
      onClose={onClose}
      onRefresh={onRefresh}
      onSubmit={(event) => {
        event.preventDefault();
        if (reservePlaceUnavailable && !form.pendingReserve) return;
        void form.submit(event, fullyCovered ? reserveLocation?.id : "");
      }}
      commentRequired={false}
      placeError={showPlace ? placeError : null}
      retryPlaces={choices.retry}
      blockSave={reservePlaceUnavailable}
    >
      {orderId === undefined && (
        <ReservationOrderPicker value={order} onChange={setOrder} />
      )}
      <ReceiptItemPicker
        value={form.item}
        onChange={(item) => {
          form.setItem(item);
          form.setLocationId("");
        }}
      />
      <TextField
        label={form.item ? `Потребность, ${form.item.unit}` : "Потребность"}
        required
        inputMode="decimal"
        value={form.quantity}
        onChange={form.setQuantity}
      />
      {showPlace && (
        <SelectField
          label="Место хранения"
          searchable
          value={form.locationId}
          onChange={form.setLocationId}
          disabled={!selectedItemId || choices.loading || !!choices.error}
          options={choices.locations.map((location) => {
            const label = `${location.warehouse.name} — ${location.name}`;
            const freeQuantity = formatStockQuantity(
              choices.free?.[location.id] ?? "0",
            );
            return {
              value: location.id,
              label,
              title: label,
              content: (
                <span className="reservation-location-option">
                  <span>{label}</span>
                  <small>
                    {freeQuantity} {form.item?.unit}
                  </small>
                </span>
              ),
            };
          })}
        />
      )}
      {showPlace && form.locationId && (
        <button
          type="button"
          className="admin-secondary-button"
          onClick={() => form.setLocationId("")}
        >
          Очистить место
        </button>
      )}
      {showPlace && !choices.loading && !reservePlaceUnavailable && (
        <p role="status">
          {fullyCovered
            ? `Будет зарезервировано ${displayQuantity(requiredAmount)} в ${reserveLocation?.name}.`
            : `${reserveLocation ? `В выбранном месте не хватает ${displayQuantity(requiredAmount - reserveStock)}. ` : ""}При сохранении дефицит составит ${displayQuantity(requiredAmount)}.`}
        </p>
      )}
    </ReservationOperationModal>
  );
}
