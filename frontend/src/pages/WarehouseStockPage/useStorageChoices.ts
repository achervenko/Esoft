import { useEffect, useState } from "react";
import { type Warehouse } from "../../shared/api/warehouses-api";
import { type StorageLocation } from "../../shared/api/storage-locations-api";
import { getApiErrorMessage } from "../../shared/api/api-error";
import { warehouseStockApi } from "../../shared/api/warehouse-stock-api";
export function useStorageChoices(
  enabled: boolean,
  warehouseId: string,
  activeOnly = false,
) {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [places, setPlaces] = useState<{
    key: string;
    rows: StorageLocation[];
  } | null>(null);
  const [warehouseLoading, setWarehouseLoading] = useState(true),
    [locationLoading, setLocationLoading] = useState(true);
  const [warehouseError, setWarehouseError] = useState<string | null>(null),
    [locationError, setLocationError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    const c = new AbortController();
    setWarehouseLoading(true);
    setWarehouseError(null);
    void (async () => {
      const rows: Warehouse[] = [];
      for (let page = 1; ; page++) {
        const q = new URLSearchParams({ page: String(page), limit: "100" });
        if (activeOnly) q.set("isActive", "true");
        const result = await warehouseStockApi.warehouses(q, c.signal);
        if (c.signal.aborted) return;
        rows.push(...result.items);
        if (rows.length >= result.total || !result.items.length) break;
      }
      if (!c.signal.aborted) setWarehouses(rows);
    })()
      .catch((e) => {
        if (!c.signal.aborted) setWarehouseError(getApiErrorMessage(e));
      })
      .finally(() => {
        if (!c.signal.aborted) setWarehouseLoading(false);
      });
    return () => c.abort();
  }, [enabled, activeOnly, attempt]);
  useEffect(() => {
    if (!enabled) return;
    const c = new AbortController();
    setLocationLoading(true);
    setLocationError(null);
    void (async () => {
      const rows: StorageLocation[] = [];
      for (let page = 1; ; page++) {
        const q = new URLSearchParams({ page: String(page), limit: "100" });
        if (warehouseId) q.set("warehouseId", warehouseId);
        if (activeOnly) q.set("isActive", "true");
        const result = await warehouseStockApi.storageLocations(q, c.signal);
        if (c.signal.aborted) return;
        rows.push(...result.items);
        if (rows.length >= result.total || !result.items.length) break;
      }
      if (!c.signal.aborted) setPlaces({ key: warehouseId, rows });
    })()
      .catch((e) => {
        if (!c.signal.aborted) setLocationError(getApiErrorMessage(e));
      })
      .finally(() => {
        if (!c.signal.aborted) setLocationLoading(false);
      });
    return () => c.abort();
  }, [enabled, warehouseId, activeOnly, attempt]);
  return {
    warehouses: enabled ? warehouses : [],
    locations: enabled && places?.key === warehouseId ? places.rows : [],
    loading: enabled ? warehouseLoading || locationLoading : false,
    error: enabled ? (warehouseError ?? locationError) : null,
    retry: () => setAttempt((v) => v + 1),
  };
}
