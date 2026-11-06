import { useState } from "react";

function readPosition(key: string | null) {
  try {
    return key ? sessionStorage.getItem(key) : null;
  } catch {
    return null;
  }
}
export function useReceiptPosition(actorId: string | null, receiptId: string) {
  const key = actorId
    ? `warehouse.receipts.position:${actorId}:${receiptId}`
    : null;
  const [selection, setSelection] = useState(() => ({
    key,
    value: readPosition(key),
  }));
  const position = selection.key === key ? selection.value : readPosition(key);
  const select = (value: string) => {
    setSelection({ key, value });
    try {
      if (key) sessionStorage.setItem(key, value);
    } catch {
      // Placement remains usable when browser storage is unavailable.
    }
  };
  return [position, select] as const;
}
