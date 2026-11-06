import { useEffect, useState } from "react";
import {
  receiptsApi,
  type ReceiptSummary,
} from "../../shared/api/warehouse-receipts-api";
import { useIncrementalList } from "../../shared/lib/useIncrementalList";
import type { ReceiptListPreferences } from "./receipt-list-preferences";

export function useReceiptList(preferences: ReceiptListPreferences) {
  const {
    sort,
    search,
    warehouseId,
    source,
    states,
    problems,
    documentDateFrom,
    documentDateTo,
  } = preferences;
  const invalidPeriod = !!(
    documentDateFrom &&
    documentDateTo &&
    documentDateFrom > documentDateTo
  );
  const [debounced, setDebounced] = useState(search.trim());
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebounced(search.trim());
    }, 250);
    return () => clearTimeout(timer);
  }, [search]);
  const query = useIncrementalList({
    queryKey: JSON.stringify([
      documentDateFrom,
      documentDateTo,
      debounced,
      warehouseId,
      source,
      states,
      problems,
      sort,
    ]),
    enabled: !invalidPeriod,
    getKey: (row: ReceiptSummary) => row.id,
    loadPage: (offset, signal) => {
      const params = new URLSearchParams({
        page: String(offset / 50 + 1),
        limit: "50",
        sortBy: sort.key,
        sortOrder: sort.direction,
      });
      if (documentDateFrom) params.set("documentDateFrom", documentDateFrom);
      if (documentDateTo) params.set("documentDateTo", documentDateTo);
      if (debounced) params.set("search", debounced);
      if (warehouseId) params.set("warehouseId", warehouseId);
      if (source) params.set("source", source);
      params.set(
        "status",
        states.length ? states.join(",") : "RECEIVED,PLACING,PLACED,CANCELLED",
      );
      if (states.length && !states.includes("CONFLICT"))
        params.set("hasConflict", "false");
      if (problems) params.set("attention", problems);
      return receiptsApi.list(params, signal);
    },
  });
  return { query, invalidPeriod };
}
