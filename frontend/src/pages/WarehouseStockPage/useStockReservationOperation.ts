import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  warehouseStockApi,
  type StockDistribution,
  type ReservationOperationInput,
} from "../../shared/api/warehouse-stock-api";
import {
  ApiRequestError,
  getApiErrorMessage,
} from "../../shared/api/api-error";
import type { StockDistributionSource } from "./StockDistributionTable";
import { quantityMillis, transferRequestKey } from "./stock-page.utils";
import {
  readReservationOperation,
  reservationOperationKey,
} from "./pending-reservation-operation";
export type StockReservationOperationProps = {
  data: StockDistribution;
  source: StockDistributionSource;
  onSaved: () => void;
  onClose: () => void;
  onSavingChange: (v: boolean) => void;
};
export function useStockReservationOperation({
  data,
  source,
  onSaved,
  onSavingChange,
}: StockReservationOperationProps) {
  const reservation = source.reservation!;
  const [restored] = useState(() => {
    const saved = readReservationOperation();
    return saved?.source.reservation?.id === reservation.id ? saved : null;
  });
  const [pending, setPending] = useState(restored?.input ?? null);
  const [action, setAction] = useState<ReservationOperationInput["action"]>(
    pending?.action ?? "RELEASE",
  );
  const [quantity, setQuantity] = useState(pending?.quantity ?? "");
  const [comment, setComment] = useState(pending?.comment ?? "");
  const [document, setDocument] = useState<{
    uploadId: string;
    originalName: string;
  } | null>(
    pending?.attachments.length
      ? {
          uploadId: pending.attachments[0],
          originalName: "Прикреплённый документ",
        }
      : null,
  );
  const [saving, setSaving] = useState(false),
    [uploading, setUploading] = useState(false),
    [error, setError] = useState<string | null>(null);
  const busy = useRef(false);
  const locked = saving || uploading || !!pending;
  useEffect(() => {
    onSavingChange(locked);
  }, [locked, onSavingChange]);
  const borrowed = quantityMillis(reservation.borrowedQuantity ?? "0") ?? 0n,
    free = quantityMillis(source.balance.available) ?? 0n;
  const maximum =
    action === "RELEASE"
      ? (quantityMillis(reservation.quantity) ?? 0n)
      : action === "BORROW"
        ? (quantityMillis(
            reservation.movableQuantity ?? reservation.quantity,
          ) ?? 0n)
        : borrowed < free
          ? borrowed
          : free;
  const normalized = quantity.trim().replace(",", ".");
  const amount = quantityMillis(normalized);
  const valid =
    amount !== null &&
    amount > 0n &&
    amount <= maximum &&
    !!comment.trim() &&
    (action !== "RELEASE" || !!document);
  const clear = () => {
    sessionStorage.removeItem(reservationOperationKey);
    setPending(null);
  };
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (busy.current || uploading || (!pending && !valid)) return;
    busy.current = true;
    setSaving(true);
    setError(null);
    const input = pending ?? {
      action,
      quantity: normalized,
      expectedQuantity: reservation.quantity,
      expectedBorrowedQuantity: reservation.borrowedQuantity ?? "0",
      requestKey: transferRequestKey(),
      comment: comment.trim(),
      attachments: document ? [document.uploadId] : [],
    };
    try {
      const actorId = await warehouseStockApi.currentUserId();
      const saved = readReservationOperation();
      if (
        saved &&
        (saved.actorId !== actorId ||
          saved.input.requestKey !== input.requestKey)
      )
        throw new Error(
          "Сначала подтвердите предыдущую операцию под тем же пользователем.",
        );
      sessionStorage.setItem(
        reservationOperationKey,
        JSON.stringify({ input, data, source, actorId }),
      );
      setPending(input);
      try {
        await warehouseStockApi.reservationOperation(reservation.id!, input);
        clear();
        onSavingChange(false);
        onSaved();
      } catch (e) {
        if (
          e instanceof ApiRequestError &&
          e.status >= 400 &&
          e.status < 500 &&
          ![401, 403, 408].includes(e.status) &&
          e.code !== "WAREHOUSE_RESERVATION_REQUEST_CONFLICT"
        )
          clear();
        throw e;
      }
    } catch (e) {
      setError(getApiErrorMessage(e));
    } finally {
      busy.current = false;
      setSaving(false);
    }
  };
  const uploadDocument = async (selected: File) => {
    setUploading(true);
    setError(null);
    try {
      setDocument(await warehouseStockApi.uploadReservationDocument(selected));
    } catch (e) {
      setError(getApiErrorMessage(e));
    } finally {
      setUploading(false);
    }
  };
  return {
    reservation,
    pending,
    action,
    setAction,
    quantity,
    setQuantity,
    comment,
    setComment,
    document,
    setDocument,
    saving,
    uploading,
    error,
    locked,
    borrowed,
    maximum,
    normalized,
    amount,
    valid,
    submit,
    uploadDocument,
  };
}
