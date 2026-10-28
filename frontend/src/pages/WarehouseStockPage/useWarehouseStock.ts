import { useEffect, useState } from "react";
import {
  warehouseStockApi,
  type StockPosition,
} from "../../shared/api/warehouse-stock-api";
import { useIncrementalList } from "../../shared/lib/useIncrementalList";
export type StockSort = {
  key: "article" | "name" | "quantity" | "warehouse";
  direction: "asc" | "desc";
};
export function useWarehouseStock(enabled: boolean) {
  const [search, setSearch] = useState(""),
    [settledSearch, setSettledSearch] = useState("");
  const [warehouseId, setWarehouseId] = useState(""),
    [locationId, setLocationId] = useState("");
  const [quantityState, setQuantityState] = useState("POSITIVE");
  const [sort, setSort] = useState<StockSort>({
    key: "article",
    direction: "asc",
  });
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const timer = setTimeout(() => setSettledSearch(search), 250);
    return () => clearTimeout(timer);
  }, [search]);
  const list = useIncrementalList({
    enabled,
    keepPreviousData: true,
    queryKey: JSON.stringify([
      settledSearch,
      warehouseId,
      locationId,
      quantityState,
      sort,
      revision,
    ]),
    getKey: (row: StockPosition) => row.id,
    loadPage: (offset, signal) =>
      warehouseStockApi.list(
        new URLSearchParams({
          search: settledSearch,
          quantityState,
          sortBy: sort.key,
          sortOrder: sort.direction,
          page: String(Math.floor(offset / 50) + 1),
          limit: "50",
          ...(warehouseId ? { warehouseId } : {}),
          ...(locationId ? { locationId } : {}),
        }),
        signal,
      ),
  });
  return {
    list,
    search,
    setSearch,
    warehouseId,
    locationId,
    quantityState,
    setQuantityState,
    sort,
    setSort,
    setWarehouse: (id: string) => {
      setWarehouseId(id);
      setLocationId("");
    },
    setLocationId,
    reset: () => {
      setSearch("");
      setSettledSearch("");
      setWarehouseId("");
      setLocationId("");
      setQuantityState("POSITIVE");
    },
    refresh: () => setRevision((v) => v + 1),
  };
}
