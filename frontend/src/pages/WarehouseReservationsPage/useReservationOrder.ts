import { useEffect, useRef, useState } from "react";
import {
  warehouseReservationsApi,
  type Reservation,
  type ReservationOrderSummary,
} from "../../shared/api/warehouse-reservations-api";
import { getApiErrorMessage } from "../../shared/api/api-error";
import { useIncrementalList } from "../../shared/lib/useIncrementalList";

export function useReservationOrder(id: string) {
  const [search, setSearch] = useState("");
  const [settledSearch, setSettledSearch] = useState("");
  const [deficitOnly, setDeficitOnly] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setSettledSearch(search.trim()), 250);
    return () => clearTimeout(timer);
  }, [search]);
  const queryKey = JSON.stringify([id, settledSearch, deficitOnly]);
  const [summary, setSummary] = useState<ReservationOrderSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    // Retain the current list while refreshing after a command.
    setError(null);
    warehouseReservationsApi
      .summary(id, controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setSummary(data);
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(getApiErrorMessage(e));
      });
    return () => controller.abort();
  }, [id, revision]);
  const loaded = useRef(50);
  const refreshPages = useRef(1);
  const list = useIncrementalList({
    enabled: !!summary,
    queryKey: `${queryKey}:${revision}`,
    keepPreviousData: true,
    getKey: (row: Reservation) => row.id,
    loadPage: async (offset, signal) => {
      const items: Reservation[] = [];
      let result;
      const pages = offset === 0 ? refreshPages.current : 1;
      for (let n = 0; n < pages; n++) {
        result = await warehouseReservationsApi.list(
          new URLSearchParams({
            orderId: id,
            quantityState: "POSITIVE",
            search: settledSearch,
            ...(deficitOnly ? { deficit: "true" } : {}),
            page: String(offset / 50 + n + 1),
            limit: "50",
          }),
          signal,
        );
        items.push(...result.items);
        if (!result.items.length || offset + items.length >= result.total)
          break;
      }
      return {
        ...result!,
        items,
        limit: Math.max(50, Math.ceil(items.length / 50) * 50),
      };
    },
  });
  loaded.current = list.data?.items.length ?? 50;
  return {
    refresh: () => {
      refreshPages.current = Math.max(1, Math.ceil(loaded.current / 50));
      setRevision((v) => v + 1);
    },
    summary,
    error,
    retry: () => setRevision((v) => v + 1),
    list,
    search,
    setSearch,
    deficitOnly,
    setDeficitOnly,
    queryKey,
  };
}
