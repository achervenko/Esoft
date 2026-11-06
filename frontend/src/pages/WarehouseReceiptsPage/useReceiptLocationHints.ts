import { useEffect, useState } from "react";
import {
  warehouseStockApi,
  type StockDistribution,
} from "../../shared/api/warehouse-stock-api";
import {
  formatStockQuantity,
  quantityMillis,
} from "../../shared/lib/warehouse-quantity";
import type { StorageLocation } from "../../shared/api/storage-locations-api";

export function placementLocationOptions(
  locations: Pick<StorageLocation, "id" | "name">[],
  balances: StockDistribution["locations"],
  unit: string,
) {
  const quantities = new Map(
    balances.map((entry) => [entry.location.id, entry.quantity]),
  );
  return locations
    .map((location) => {
      const quantity = quantities.get(location.id) ?? "0";
      return { location, quantity, millis: quantityMillis(quantity) ?? 0n };
    })
    .sort((a, b) =>
      a.millis === b.millis
        ? a.location.name.localeCompare(b.location.name, "ru", {
            numeric: true,
          })
        : a.millis > b.millis
          ? -1
          : 1,
    )
    .map(({ location, quantity, millis }) => ({
      value: location.id,
      label: location.name,
      quantityLabel:
        millis > 0n ? `${formatStockQuantity(quantity)} ${unit}` : "",
    }));
}

export function useReceiptLocationHints(
  itemId: string | null,
  warehouseId: string | null,
  enabled: boolean,
) {
  const [balances, setBalances] = useState<StockDistribution["locations"]>([]);
  const [error, setError] = useState(false);
  useEffect(() => {
    setBalances([]);
    setError(false);
    if (!enabled || !itemId || !warehouseId) return;
    const controller = new AbortController();
    warehouseStockApi
      .distribution(itemId, warehouseId, controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) setBalances(result.locations);
      })
      .catch(() => {
        if (!controller.signal.aborted) setError(true);
      });
    return () => controller.abort();
  }, [itemId, warehouseId, enabled]);
  return { balances, error };
}
