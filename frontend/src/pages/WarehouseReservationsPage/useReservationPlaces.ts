import { useEffect, useState } from "react";
import { warehouseStockApi } from "../../shared/api/warehouse-stock-api";
import { getApiErrorMessage } from "../../shared/api/api-error";
import type { StorageLocation } from "../../shared/api/storage-locations-api";
export function useReservationPlaces(itemId: string, enabled: boolean) {
  const [state, setState] = useState<{
    key: string;
    locations: StorageLocation[];
    error: string | null;
    loading: boolean;
  }>({ key: "", locations: [], error: null, loading: false });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!enabled || !itemId) return;
    const controller = new AbortController();
    setState({ key: itemId, locations: [], error: null, loading: true });
    void (async () => {
      const locations: StorageLocation[] = [];
      for (let page = 1; ; page++) {
        const result = await warehouseStockApi.balances(
          new URLSearchParams({
            itemId,
            quantityState: "POSITIVE",
            itemActive: "true",
            locationActive: "true",
            page: String(page),
            limit: "100",
            sortBy: "location",
            sortOrder: "asc",
          }),
          controller.signal,
        );
        if (controller.signal.aborted) return;
        locations.push(
          ...result.items
            .map((row) => row.location)
            .filter((l) => l.warehouse.isActive),
        );
        if (page * result.limit >= result.total || !result.items.length) break;
      }
      if (!controller.signal.aborted)
        setState({ key: itemId, locations, error: null, loading: false });
    })().catch((error) => {
      if (!controller.signal.aborted)
        setState({
          key: itemId,
          locations: [],
          error: getApiErrorMessage(error),
          loading: false,
        });
    });
    return () => controller.abort();
  }, [itemId, enabled, attempt]);
  const current = enabled && itemId && state.key === itemId;
  return {
    locations: current ? state.locations : [],
    loading: !!(enabled && itemId && (!current || state.loading)),
    error: current ? state.error : null,
    retry: () => setAttempt((v) => v + 1),
  };
}
