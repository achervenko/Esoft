import {
  readPendingStockMovement,
  persistStockMovement,
  clearPendingStockMovement,
} from "./pending-stock-movement";
import { useEffect, useRef, useState } from "react";
import {
  warehouseStockApi,
  type StockDistribution,
  type StockTransferInput,
} from "../../shared/api/warehouse-stock-api";
import {
  ApiRequestError,
  getApiErrorMessage,
} from "../../shared/api/api-error";
import { useStorageChoices } from "./useStorageChoices";
import { transferRequestKey } from "./stock-page.utils";
import { stockTransferQuantity } from "./StockTransferQuantity";

export function useStockTransferForm({
  data,
  source,
  onSaved,
  onSavingChange,
}: {
  data: StockDistribution;
  source: StockDistribution["locations"][number];
  onSaved: () => void;
  onSavingChange?: (saving: boolean) => void;
}) {
  const [restored] = useState(() => {
    const saved = readPendingStockMovement();
    return saved?.kind === "transfer" &&
      saved.input.itemId === data.item.id &&
      saved.data.warehouse.id === data.warehouse.id &&
      saved.input.fromLocationId === source.location.id
      ? saved
      : null;
  });
  const [warehouseId, setWarehouseId] = useState(
      restored?.warehouseId ?? data.warehouse.id,
    ),
    [locationId, setLocationId] = useState(restored?.input.toLocationId ?? "");
  const [quantity, setQuantity] = useState(restored?.input.quantity ?? ""),
    [comment, setComment] = useState(restored?.input.comment ?? "");
  const [commentOpen, setCommentOpen] = useState(!!restored?.input.comment);
  const [saving, setSaving] = useState(false),
    [error, setError] = useState<string | null>(null);
  const busy = useRef(false);
  const [pending, setPending] = useState<StockTransferInput | null>(
    restored?.input ?? null,
  );
  const pendingRef = useRef<StockTransferInput | null>(restored?.input ?? null);
  const locked = saving || !!pending;
  useEffect(() => {
    onSavingChange?.(locked);
  }, [locked, onSavingChange]);
  const choices = useStorageChoices(true, warehouseId, true);
  const warehouseOptions =
    choices.loading && !choices.warehouses.length
      ? [data.warehouse]
      : choices.warehouses;
  const { normalized, amount, available, quantityError } =
    stockTransferQuantity(quantity, source.quantity, data.item.unit);
  const valid =
    amount !== null &&
    amount > 0n &&
    available !== null &&
    amount <= available &&
    !!locationId &&
    locationId !== source.location.id;
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (
      busy.current ||
      (!pendingRef.current && (!valid || choices.loading || choices.error))
    )
      return;
    busy.current = true;
    setSaving(true);
    onSavingChange?.(true);
    setError(null);
    const retry = pendingRef.current !== null;
    const attempt = pendingRef.current ?? {
      requestKey: transferRequestKey(),
      itemId: data.item.id,
      fromLocationId: source.location.id,
      toLocationId: locationId,
      quantity: normalized,
      comment: comment.trim(),
    };
    try {
      await persistStockMovement({
        kind: "transfer",
        data,
        input: attempt,
        warehouseId,
        source: { balance: source },
      });
    } catch (e) {
      setError(getApiErrorMessage(e));
      busy.current = false;
      setSaving(false);
      onSavingChange?.(!!pendingRef.current);
      return;
    }
    pendingRef.current = attempt;
    setPending(attempt);
    try {
      await warehouseStockApi.transfer(attempt);
      clearPendingStockMovement(attempt.requestKey);
      pendingRef.current = null;
      setPending(null);
      onSavingChange?.(false);
      onSaved();
    } catch (e) {
      if (
        e instanceof ApiRequestError &&
        e.status >= 400 &&
        e.status < 500 &&
        e.status !== 408 &&
        (!retry ||
          (e.status === 409 &&
            e.code?.startsWith("WAREHOUSE_") &&
            e.code !== "WAREHOUSE_TRANSFER_REQUEST_CONFLICT"))
      ) {
        clearPendingStockMovement(attempt.requestKey);
        pendingRef.current = null;
        setPending(null);
      }
      setError(getApiErrorMessage(e));
    } finally {
      busy.current = false;
      setSaving(false);
    }
  }
  return {
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
    saving,
    error,
    pending,
    locked,
    choices,
    warehouseOptions,
    amount,
    valid,
    quantityError,
    submit,
  };
}
