import { useRef, useState } from "react";
import {
  ApiRequestError,
  getApiErrorMessage,
} from "../../shared/api/api-error";
import { warehouseReservationsApi as api } from "../../shared/api/warehouse-reservations-api";
import type { WarehouseItem } from "../../shared/api/warehouse-catalog-api";
import {
  quantityMillis,
  formatStockQuantity,
} from "../../shared/lib/warehouse-quantity";
import type { ReservationOperation } from "./reservation-operation";

export function useReservationOperation(
  operation: ReservationOperation,
  orderId: string,
  onSaved: () => void,
) {
  const r = "reservation" in operation ? operation.reservation : null;
  const [item, setItem] = useState<WarehouseItem | null>(null);
  const [locationId, setLocationId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [comment, setComment] = useState("");
  const [allocations, setAllocations] = useState<Record<string, string>>({});
  const [deficitQuantity, setDeficitQuantity] = useState("");
  const [saving, setSaving] = useState(false),
    [error, setError] = useState<string | null>(null),
    [uncertain, setUncertain] = useState(false);
  const busy = useRef(false);
  const normalize = (value: string) => value.trim().replace(",", ".");
  const amount = quantityMillis(normalize(quantity));
  const source = r?.allocations.find(
    (a) =>
      a.location.id === ("locationId" in operation ? operation.locationId : ""),
  );
  const amounts = Object.entries(allocations).map(([id, value]) => ({
    locationId: id,
    quantity: normalize(value || "0"),
  }));
  const deficit = normalize(deficitQuantity || "0");
  const decreaseAmounts = [
    ...amounts.map((a) => quantityMillis(a.quantity)),
    quantityMillis(deficit),
  ];
  const decreaseTotal = decreaseAmounts.reduce<bigint>(
    (sum, n) => sum + (n ?? 0n),
    0n,
  );
  let valid =
    operation.kind === "decrease"
      ? decreaseAmounts.every((n) => n !== null) &&
        decreaseTotal > 0n &&
        amounts.every(
          (a) =>
            (quantityMillis(a.quantity) ?? 0n) <=
            (quantityMillis(
              r?.allocations.find((b) => b.location.id === a.locationId)
                ?.quantity ?? "0",
            ) ?? 0n),
        ) &&
        (quantityMillis(deficit) ?? 0n) <=
          (quantityMillis(r?.deficitQuantity ?? "0") ?? 0n)
      : amount !== null && amount > 0n;
  if (operation.kind === "reserve") valid = valid && !!item && !!locationId;
  if (operation.kind === "restore")
    valid =
      valid &&
      !!locationId &&
      (amount ?? 0n) <= (quantityMillis(r?.deficitQuantity ?? "0") ?? 0n);
  if (operation.kind === "reduce")
    valid =
      valid &&
      !!source &&
      (amount ?? 0n) <= (quantityMillis(source?.quantity ?? "0") ?? 0n);
  if (operation.kind !== "reserve") valid = valid && !!comment.trim();
  const locked = saving || uncertain;
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy.current || uncertain || !valid) return;
    busy.current = true;
    setSaving(true);
    setError(null);
    let dispatched = false;
    try {
      if (operation.kind === "reserve") {
        dispatched = true;
        await api.reserve({
          orderId,
          itemId: item!.id,
          locationId,
          quantity: normalize(quantity),
          comment: comment.trim(),
        });
      } else if (operation.kind === "decrease") {
        dispatched = true;
        await api.decrease(operation.reservation.id, {
          allocations: amounts.filter(
            (a) => (quantityMillis(a.quantity) ?? 0n) > 0n,
          ),
          deficitQuantity: deficit,
          comment: comment.trim(),
        });
      } else {
        dispatched = true;
        await api[
          operation.kind === "reduce" ? "reduceCoverage" : "restoreCoverage"
        ](operation.reservation.id, {
          locationId:
            operation.kind === "reduce" ? operation.locationId : locationId,
          quantity: normalize(quantity),
          comment: comment.trim(),
        });
      }
      onSaved();
    } catch (e) {
      const definite =
        e instanceof ApiRequestError &&
        e.status >= 400 &&
        e.status < 500 &&
        e.status !== 408;
      if (dispatched && !definite) setUncertain(true);
      setError(getApiErrorMessage(e));
    } finally {
      busy.current = false;
      setSaving(false);
    }
  }
  const decreasePreview = formatStockQuantity(
    `${decreaseTotal / 1000n}.${(decreaseTotal % 1000n).toString().padStart(3, "0")}`.replace(
      /\.?0+$/,
      "",
    ),
  );
  return {
    r,
    source,
    item,
    setItem,
    locationId,
    setLocationId,
    quantity,
    setQuantity,
    comment,
    setComment,
    allocations,
    setAllocations,
    deficitQuantity,
    setDeficitQuantity,
    valid,
    locked,
    saving,
    uncertain,
    error,
    submit,
    decreasePreview,
  };
}
