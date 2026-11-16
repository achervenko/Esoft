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
  actorId?: string | null;
  data: StockDistribution;
  balance: StockDistribution["locations"][number];
  portion?: { reservationId?: string; quantity: string };
  onClose: () => void;
  onSaved: () => void;
  onSavingChange: (saving: boolean) => void;
};
type SurplusFormProps = Pick<
  StockAdjustmentFormProps,
  "actorId" | "onSaved"
> & {
  itemId: string;
  locationId: string;
};
export function useStockAdjustmentForm(
  props: StockAdjustmentFormProps | SurplusFormProps,
) {
  const actual = "balance" in props ? props : null;
  const portion = actual?.portion;
  const itemId = "itemId" in props ? props.itemId : props.data.item.id;
  const locationId =
    "locationId" in props ? props.locationId : props.balance.location.id;
  const balanceQuantity = actual?.balance.quantity ?? "0";
  const target = actual
    ? `${actual.balance.balanceId}${portion ? `:${portion.reservationId ?? "free"}` : ""}`
    : "surplus";
  const storageKey = props.actorId
    ? `stock-adjustment:${encodeURIComponent(props.actorId)}:${target}`
    : null;
  const [pending, setPending] = useState<StockAdjustmentInput | null>(() => {
    try {
      if (!storageKey) return null;
      const saved = JSON.parse(
        sessionStorage.getItem(storageKey) ?? "null",
      ) as StockAdjustmentInput | null;
      if (!saved) return null;
      if (!actual)
        return "type" in saved && saved.type === "SURPLUS" ? saved : null;
      return "actualQuantity" in saved &&
        saved.itemId === itemId &&
        saved.locationId === locationId
        ? saved
        : null;
    } catch {
      return null;
    }
  });
  const [quantity, setQuantity] = useState(
    pending
      ? "type" in pending
        ? pending.quantity
        : (pending.portion?.actualQuantity ?? pending.actualQuantity)
      : (portion?.quantity ?? (actual ? balanceQuantity : "")),
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
  const before = quantityMillis(portion?.quantity ?? balanceQuantity)!;
  const delta = amount === null ? 0n : amount - before;
  const locked = saving || uploading || !!pending;
  const onSavingChange = actual?.onSavingChange;
  useEffect(() => {
    onSavingChange?.(locked);
  }, [locked, onSavingChange]);
  const clearPending = () => {
    if (storageKey) sessionStorage.removeItem(storageKey);
    setPending(null);
  };
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (busy.current || uploading || !canSubmit) return;
    const input: StockAdjustmentInput = pending ?? {
      requestKey: transferRequestKey(),
      itemId,
      locationId,
      ...(actual
        ? {
            expectedQuantity: balanceQuantity,
            actualQuantity:
              portion && amount !== null
                ? (() => {
                    const physical = quantityMillis(balanceQuantity)! + delta;
                    return `${physical / 1000n}.${(physical % 1000n).toString().padStart(3, "0")}`.replace(
                      /\.?0+$/,
                      "",
                    );
                  })()
                : normalized,
            ...(portion
              ? {
                  portion: {
                    ...(portion.reservationId
                      ? { reservationId: portion.reservationId }
                      : {}),
                    expectedQuantity: portion.quantity,
                    actualQuantity: normalized,
                  },
                }
              : {}),
          }
        : { type: "SURPLUS", quantity: normalized }),
      reason: reason.trim(),
      attachments: attachment ? [attachment.uploadId] : [],
    };
    try {
      if (storageKey) sessionStorage.setItem(storageKey, JSON.stringify(input));
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
      onSavingChange?.(false);
      props.onSaved();
    } catch (e) {
      if (
        e instanceof ApiRequestError &&
        e.code === "STORAGE_UPLOAD_UNAVAILABLE"
      ) {
        clearPending();
        setAttachment(null);
        setError("Документ больше недоступен. Прикрепите его заново.");
        return;
      }
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
    if (busy.current || locked) return;
    busy.current = true;
    setUploading(true);
    setError(null);
    try {
      setAttachment(await warehouseStockApi.uploadAdjustmentDocument(file));
    } catch (e) {
      setError(getApiErrorMessage(e));
    } finally {
      busy.current = false;
      setUploading(false);
    }
  };
  const canSubmit =
    !!pending ||
    (!!itemId &&
      !!locationId &&
      amount !== null &&
      delta !== 0n &&
      !!reason.trim() &&
      !!attachment);
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
    canSubmit,
    submit,
    uploadDocument,
  };
}
