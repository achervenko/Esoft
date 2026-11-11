import { useEffect, useState } from "react";
import {
  warehouseReservationsApi,
  type ReservationOrderSummary,
} from "../../shared/api/warehouse-reservations-api";
import { useIncrementalList } from "../../shared/lib/useIncrementalList";

export function useReservationOrders(enabled: boolean) {
  const [revision, setRevision] = useState(0);
  const [search, setSearch] = useState("");
  const [settledSearch, setSettledSearch] = useState("");
  const [coverage, setCoverage] = useState("ALL");
  useEffect(() => {
    const timer = setTimeout(() => setSettledSearch(search.trim()), 250);
    return () => clearTimeout(timer);
  }, [search]);
  const list = useIncrementalList({
    enabled,
    queryKey: JSON.stringify([settledSearch, coverage, revision]),
    getKey: (row: ReservationOrderSummary) => row.order.id,
    loadPage: (offset, signal) =>
      warehouseReservationsApi.orders(
        new URLSearchParams({
          search: settledSearch,
          coverage,
          page: String(offset / 50 + 1),
          limit: "50",
        }),
        signal,
      ),
  });
  return {
    refresh: () => setRevision((v) => v + 1),
    search,
    setSearch,
    coverage,
    setCoverage,
    list,
  };
}
