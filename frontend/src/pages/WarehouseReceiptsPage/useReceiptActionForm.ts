import { useRef, useState } from "react";
import { getApiErrorMessage } from "../../shared/api/api-error";
import type { Receipt } from "../../shared/api/warehouse-receipts-api";
export type ReceiptActionFormProps = {
  receipt: Receipt;
  onClose: () => void;
  onSaved: () => void;
  onSavingChange: (saving: boolean) => void;
};
export function useReceiptActionForm({
  onSaved,
  onSavingChange,
}: Pick<ReceiptActionFormProps, "onSaved" | "onSavingChange">) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lock = useRef(false);
  const submit = async (run: () => Promise<unknown>) => {
    if (lock.current) return;
    lock.current = true;
    setSaving(true);
    onSavingChange(true);
    setError(null);
    try {
      await run();
      onSaved();
    } catch (error) {
      setError(getApiErrorMessage(error));
    } finally {
      lock.current = false;
      setSaving(false);
      onSavingChange(false);
    }
  };
  return { saving, error, submit };
}
