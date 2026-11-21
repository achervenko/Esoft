import { useEffect, useState } from "react";
import {
  receiptIntegrationApi,
  type ReceiptSource,
  type IntegrationFlowRegistration,
} from "../../shared/api/receipt-integration-api";
import { getApiErrorMessage } from "../../shared/api/api-error";

export function useReceiptIntegrationData(revision: number) {
  const [sources, setSources] = useState<ReceiptSource[]>([]);
  const [availableFlows, setAvailableFlows] = useState<
    IntegrationFlowRegistration[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const c = new AbortController();
    setLoading(true);
    setError(null);
    Promise.all([
      receiptIntegrationApi.sources(c.signal),
      receiptIntegrationApi.flows(c.signal),
    ])
      .then(([s, flows]) => {
        if (!c.signal.aborted) {
          setSources(s);
          setAvailableFlows(flows);
        }
      })
      .catch((e) => {
        if (!c.signal.aborted) setError(getApiErrorMessage(e));
      })
      .finally(() => {
        if (!c.signal.aborted) setLoading(false);
      });
    return () => c.abort();
  }, [revision]);
  return { sources, availableFlows, loading, error, setError };
}
