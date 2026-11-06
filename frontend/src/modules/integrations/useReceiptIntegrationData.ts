import { useEffect, useState } from "react";
import {
  receiptIntegrationApi,
  type ReceiptSource,
  type ReceiptEvent,
  type IntegrationFlowRegistration,
} from "../../shared/api/receipt-integration-api";
import { getApiErrorMessage } from "../../shared/api/api-error";

export function useReceiptIntegrationData(
  revision: number,
  page: number,
  status: string,
) {
  const [sources, setSources] = useState<ReceiptSource[]>([]);
  const [availableFlows, setAvailableFlows] = useState<
    IntegrationFlowRegistration[]
  >([]);
  const [events, setEvents] = useState<{
    items: ReceiptEvent[];
    total: number;
  }>({ items: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const c = new AbortController();
    setLoading(true);
    setError(null);
    Promise.all([
      receiptIntegrationApi.sources(c.signal),
      receiptIntegrationApi.events(page, c.signal, status),
      receiptIntegrationApi.flows(c.signal),
    ])
      .then(([s, e, flows]) => {
        if (!c.signal.aborted) {
          setSources(s);
          setAvailableFlows(flows);
          setEvents(e);
        }
      })
      .catch((e) => {
        if (!c.signal.aborted) setError(getApiErrorMessage(e));
      })
      .finally(() => {
        if (!c.signal.aborted) setLoading(false);
      });
    return () => c.abort();
  }, [revision, page, status]);
  return { sources, availableFlows, events, loading, error, setError };
}
