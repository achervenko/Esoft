import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  warehouseStockApi,
  type StockDistribution,
  type StockAdjustmentInput,
} from "../../shared/api/warehouse-stock-api";
import {
  ApiRequestError,
  getApiErrorMessage,
} from "../../shared/api/api-error";
import { quantityMillis, transferRequestKey } from "./stock-page.utils";
export type StockAdjustmentFormProps = {
  data: StockDistribution;
  balance: StockDistribution["locations"][number];
  onClose: () => void;
  onSaved: () => void;
  onSavingChange: (saving: boolean) => void;
};
export function useStockAdjustmentForm({
  data,
  balance,
  onSaved,
  onSavingChange,
}: StockAdjustmentFormProps) {
  const storageKey = `stock-adjustment:${balance.balanceId}`;
  const [pending, setPending] = useState<StockAdjustmentInput | null>(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(storageKey) ?? "null");
      return saved?.itemId === data.item.id &&
        saved?.locationId === balance.location.id
        ? saved
        : null;
    } catch {
      return null;
    }
  });
  const [quantity, setQuantity] = useState(
    pending?.actualQuantity ?? balance.quantity,
  );
  const [reason, setReason] = useState(pending?.reason ?? "");
  const [attachment, setAttachment] = useState<{
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
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const busy = useRef(false);
  const normalized = quantity.trim().replace(",", ".");
  const amount = quantityMillis(normalized);
  const before = quantityMillis(balance.quantity)!;
  const delta = amount === null ? 0n : amount - before;
  const locked = saving || uploading || !!pending;
  useEffect(() => {
    onSavingChange(locked);
  }, [locked, onSavingChange]);
  const clearPending = () => {
    sessionStorage.removeItem(storageKey);
    setPending(null);
  };
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (
      busy.current ||
      uploading ||
      (!pending &&
        (amount === null || delta === 0n || !reason.trim() || !attachment))
    )
      return;
    const input = pending ?? {
      requestKey: transferRequestKey(),
      itemId: data.item.id,
      locationId: balance.location.id,
      expectedQuantity: balance.quantity,
      actualQuantity: normalized,
      reason: reason.trim(),
      attachments: attachment ? [attachment.uploadId] : [],
    };
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(input));
    } catch {
      setError(
        "Не удалось сохранить запрос для безопасного повтора. Проверьте доступность хранилища браузера.",
      );
      return;
    }
    busy.current = true;
    setPending(input);
    setSaving(true);
    setError(null);
    try {
      await warehouseStockApi.adjust(input);
      clearPending();
      onSavingChange(false);
      onSaved();
    } catch (e) {
      if (
        e instanceof ApiRequestError &&
        e.status >= 400 &&
        e.status < 500 &&
        e.status !== 408 &&
        e.status !== 401 &&
        e.status !== 403 &&
        e.code !== "WAREHOUSE_ADJUSTMENT_REQUEST_CONFLICT"
      )
        clearPending();
      setError(getApiErrorMessage(e));
    } finally {
      busy.current = false;
      setSaving(false);
    }
  };
  const uploadDocument = async (file: File) => {
    setUploading(true);
    setError(null);
    try {
      setAttachment(await warehouseStockApi.uploadAdjustmentDocument(file));
    } catch (e) {
      setError(getApiErrorMessage(e));
    } finally {
      setUploading(false);
    }
  };
  return {
    quantity,
    setQuantity,
    reason,
    setReason,
    attachment,
    setAttachment,
    uploading,
    saving,
    error,
    pending,
    amount,
    delta,
    locked,
    submit,
    uploadDocument,
  };
}
