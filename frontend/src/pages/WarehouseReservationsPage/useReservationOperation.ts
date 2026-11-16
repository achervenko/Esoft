import { useRef, useState } from "react";
import {
  ApiRequestError,
  getApiErrorMessage,
} from "../../shared/api/api-error";
import { warehouseReservationsApi as api } from "../../shared/api/warehouse-reservations-api";
import type { ReserveInput } from "../../shared/api/warehouse-reservations-api";
import { createRequestKey } from "../../shared/lib/request-key";
import { pendingReserveKey, readPendingReserve } from "./pending-reserve";
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
  actorId?: string | null,
) {
  const r = "reservation" in operation ? operation.reservation : null;
  const [item, setItem] = useState<WarehouseItem | null>(null);
  const [locationId, setLocationId] = useState(
    operation.kind === "demand" ? (operation.locationId ?? "") : "",
  );
  const source =
    operation.kind === "reduce"
      ? operation.reservation.allocations.find(
          (a) => a.location.id === operation.locationId,
        )
      : undefined;
  const [quantity, setQuantity] = useState(
    formatStockQuantity(source?.quantity ?? ""),
  );
  const [comment, setComment] = useState("");
  const [allocations, setAllocations] = useState<Record<string, string>>({});
  const [deficitQuantity, setDeficitQuantity] = useState("");
  const [demand, setDemand] = useState(formatStockQuantity(r?.quantity ?? ""));
  const [cover, setCover] = useState("");
  const [pendingReserve, setPendingReserve] = useState<ReserveInput | null>(
    () => (operation.kind === "reserve" ? readPendingReserve(actorId) : null),
  );
  const [saving, setSaving] = useState(false),
    [error, setError] = useState<string | null>(null),
    [uncertain, setUncertain] = useState(false);
  const busy = useRef(false);
  const normalize = (value: string) => value.trim().replace(",", ".");
  const amount = quantityMillis(normalize(quantity));
  const coveredAmount = source ? quantityMillis(source.quantity) : null;
  const reduction =
    coveredAmount !== null && amount !== null ? coveredAmount - amount : 0n;
  const currentDemand = quantityMillis(r?.quantity ?? "0") ?? 0n;
  const currentDeficit = quantityMillis(r?.deficitQuantity ?? "0") ?? 0n;
  const targetDemand = quantityMillis(normalize(demand));
  const demandDelta = targetDemand === null ? 0n : targetDemand - currentDemand;
  const release =
    demandDelta < -currentDeficit ? -demandDelta - currentDeficit : 0n;
  const coverAmount = quantityMillis(normalize(cover || "0"));
  const amounts = Object.entries(allocations).map(([id, value]) => ({
    locationId: id,
    quantity: normalize(value || "0"),
  }));
  const deficit =
    operation.kind === "demand"
      ? decimalQuantity(demandDelta < 0n ? -demandDelta - release : 0n)
      : normalize(deficitQuantity || "0");
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
  if (operation.kind === "reserve")
    valid = !!pendingReserve || (valid && !!orderId && !!item);
  if (operation.kind === "restore")
    valid =
      valid &&
      !!locationId &&
      (amount ?? 0n) <= (quantityMillis(r?.deficitQuantity ?? "0") ?? 0n);
  if (operation.kind === "reduce")
    valid = reduction > 0n || (reduction < 0n && -reduction <= currentDeficit);
  if (operation.kind === "demand") {
    const released = decreaseTotal - (quantityMillis(deficit) ?? 0n);
    valid =
      demandDelta > 0n
        ? coverAmount !== null &&
          coverAmount <= currentDeficit + demandDelta &&
          (coverAmount === 0n || (!!operation.canCover && !!locationId))
        : demandDelta < 0n &&
          released === release &&
          amounts.every((entry) => {
            const value = quantityMillis(entry.quantity);
            return (
              value !== null &&
              value <=
                (quantityMillis(
                  r?.allocations.find(
                    (row) => row.location.id === entry.locationId,
                  )?.quantity ?? "0",
                ) ?? 0n)
            );
          });
  }
  if (operation.kind !== "reserve") valid = valid && !!comment.trim();
  const locked = saving || uncertain || !!pendingReserve;
  const clearReserve = () => {
    if (actorId) sessionStorage.removeItem(pendingReserveKey(actorId));
    setPendingReserve(null);
  };
  async function submit(
    event: React.FormEvent,
    reserveLocationId = locationId,
  ) {
    event.preventDefault();
    if (busy.current || uncertain || !valid) return;
    busy.current = true;
    setSaving(true);
    setError(null);
    let dispatched = false;
    try {
      if (operation.kind === "reserve") {
        const input = pendingReserve ?? {
          requestKey: createRequestKey(),
          orderId,
          itemId: item!.id,
          ...(reserveLocationId ? { locationId: reserveLocationId } : {}),
          quantity: normalize(quantity),
          comment: comment.trim(),
        };
        if (actorId)
          sessionStorage.setItem(
            pendingReserveKey(actorId),
            JSON.stringify(input),
          );
        setPendingReserve(input);
        dispatched = true;
        await api.reserve(input);
        clearReserve();
      } else if (operation.kind === "demand" && demandDelta > 0n) {
        dispatched = true;
        await api.increaseDemand(operation.reservation.id, {
          expectedQuantity: operation.reservation.quantity,
          quantity: normalize(demand),
          ...(coverAmount
            ? { allocation: { locationId, quantity: normalize(cover) } }
            : {}),
          comment: comment.trim(),
        });
      } else if (operation.kind === "decrease" || operation.kind === "demand") {
        dispatched = true;
        await api.decrease(operation.reservation.id, {
          allocations: amounts.filter(
            (a) => (quantityMillis(a.quantity) ?? 0n) > 0n,
          ),
          deficitQuantity: deficit,
          ...(operation.kind === "demand"
            ? { expectedQuantity: operation.reservation.quantity }
            : {}),
          comment: comment.trim(),
        });
      } else {
        dispatched = true;
        await api[
          operation.kind === "reduce" && reduction > 0n
            ? "reduceCoverage"
            : "restoreCoverage"
        ](operation.reservation.id, {
          locationId:
            operation.kind === "reduce" ? operation.locationId : locationId,
          quantity:
            operation.kind === "reduce"
              ? decimalQuantity(reduction < 0n ? -reduction : reduction)
              : normalize(quantity),
          ...(operation.kind === "reduce" && source
            ? { expectedQuantity: source.quantity }
            : {}),
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
      if (dispatched && operation.kind === "reserve") {
        if (
          definite &&
          e instanceof ApiRequestError &&
          e.status !== 401 &&
          e.status !== 403
        )
          clearReserve();
      } else if (dispatched && !definite) setUncertain(true);
      setError(getApiErrorMessage(e));
    } finally {
      busy.current = false;
      setSaving(false);
    }
  }
  const decreasePreview = formatStockQuantity(decimalQuantity(decreaseTotal));
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
    demand,
    setDemand: (value: string) => {
      setDemand(value);
      const target = quantityMillis(normalize(value));
      const quantityToRelease =
        currentDemand - (target ?? currentDemand) - currentDeficit;
      const places =
        r?.allocations.filter((place) => place.quantity !== "0") ?? [];
      setAllocations(
        quantityToRelease > 0n && places.length === 1
          ? {
              [places[0].location.id]: formatStockQuantity(
                decimalQuantity(quantityToRelease),
              ),
            }
          : {},
      );
    },
    demandDelta,
    release,
    cover,
    setCover,
    coverAmount,
    amount,
    pendingReserve,
    reduction,
    currentDeficit,
  };
}

export function decimalQuantity(amount: bigint) {
  return `${amount / 1000n}.${(amount % 1000n).toString().padStart(3, "0")}`.replace(
    /\.?0+$/,
    "",
  );
}
