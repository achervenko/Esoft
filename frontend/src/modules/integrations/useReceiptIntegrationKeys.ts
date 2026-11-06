import { useEffect, useState } from "react";
import {
  receiptIntegrationApi,
  type ReceiptSourceKey,
} from "../../shared/api/receipt-integration-api";
import { getApiErrorMessage } from "../../shared/api/api-error";

export function useReceiptIntegrationKeys(
  selected: string,
  revision: number,
  setError: (error: string | null) => void,
) {
  const [keys, setKeys] = useState<ReceiptSourceKey[]>([]);
  useEffect(() => {
    setKeys([]);
    if (!selected) return;
    setError(null);
    const c = new AbortController();
    receiptIntegrationApi
      .keys(selected, c.signal)
      .then((rows) => {
        if (!c.signal.aborted) setKeys(rows);
      })
      .catch((e) => {
        if (!c.signal.aborted) setError(getApiErrorMessage(e));
      });
    return () => c.abort();
  }, [selected, revision, setError]);
  return keys;
}
