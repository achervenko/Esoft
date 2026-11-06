import { useEffect, useState } from "react";
import {
  warehouseStockApi,
  type StockPosition,
  type StockDistribution,
} from "../../shared/api/warehouse-stock-api";
import { getApiErrorMessage } from "../../shared/api/api-error";
export function useStockDistribution(position: StockPosition) {
  const [data, setData] = useState<StockDistribution | null>(null),
    [error, setError] = useState<string | null>(null),
    [loading, setLoading] = useState(true),
    [revision, setRevision] = useState(0);
  useEffect(() => {
    const c = new AbortController();
    setLoading(true);
    setError(null);
    void warehouseStockApi
      .distribution(position.item.id, position.warehouse.id, c.signal)
      .then((result) => {
        if (!c.signal.aborted) setData(result);
      })
      .catch((e) => {
        if (!c.signal.aborted) setError(getApiErrorMessage(e));
      })
      .finally(() => {
        if (!c.signal.aborted) setLoading(false);
      });
    return () => c.abort();
  }, [position.item.id, position.warehouse.id, revision]);
  const refresh = () => setRevision((v) => v + 1);
  return { data, error, loading, refresh };
}
