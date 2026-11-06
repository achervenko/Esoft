import { useEffect, useState } from "react";
import { warehousesApi, type Warehouse } from "../../shared/api/warehouses-api";
import {
  storageLocationsApi,
  type StorageLocation,
} from "../../shared/api/storage-locations-api";
import { getApiErrorMessage } from "../../shared/api/api-error";

export function useReceiptStorage(
  warehouseId = "",
  activeOnly = true,
  enabled = true,
) {
  const [revision, setRevision] = useState(0);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [locations, setLocations] = useState<StorageLocation[]>([]);
  const [warehousesError, setWarehousesError] = useState<string | null>(null);
  const [locationsError, setLocationsError] = useState<string | null>(null);
  useEffect(() => {
    setWarehousesError(null);
    if (!enabled) return;
    const c = new AbortController();
    void (async () => {
      const rows: Warehouse[] = [];
      for (let page = 1; ; page++) {
        const query = new URLSearchParams({ page: String(page), limit: "100" });
        if (activeOnly) query.set("isActive", "true");
        const result = await warehousesApi.list(query, c.signal);
        rows.push(...result.items);
        if (rows.length >= result.total || !result.items.length) break;
      }
      if (!c.signal.aborted) setWarehouses(rows);
    })().catch((e) => {
      if (!c.signal.aborted) setWarehousesError(getApiErrorMessage(e));
    });
    return () => c.abort();
  }, [activeOnly, enabled, revision]);
  useEffect(() => {
    setLocations([]);
    setLocationsError(null);
    if (!warehouseId || !enabled) return;
    const c = new AbortController();
    void (async () => {
      const rows: StorageLocation[] = [];
      for (let page = 1; ; page++) {
        const result = await storageLocationsApi.list(
          new URLSearchParams({
            warehouseId,
            page: String(page),
            limit: "100",
            isActive: "true",
          }),
          c.signal,
        );
        rows.push(...result.items);
        if (rows.length >= result.total || !result.items.length) break;
      }
      if (!c.signal.aborted) setLocations(rows);
    })().catch((e) => {
      if (!c.signal.aborted) setLocationsError(getApiErrorMessage(e));
    });
    return () => c.abort();
  }, [warehouseId, enabled, revision]);
  return {
    warehouses,
    locations,
    error: warehousesError ?? locationsError,
    retry: () => setRevision((value) => value + 1),
  };
}
