import { request } from "./api-client";
import type { Warehouse } from "./warehouses-api";
import type {
  StorageLocation,
  StorageLocationList,
} from "./storage-locations-api";
import type { WarehouseItem } from "./warehouse-catalog-api";
export type StockItem = Pick<
  WarehouseItem,
  "id" | "article" | "name" | "unit" | "isActive"
> & { photo: string | null };
export type StockPosition = {
  id: string;
  item: StockItem;
  warehouse: Warehouse;
  quantity: string;
  locationsCount: number;
  locationsPreview: { location: StorageLocation; quantity: string }[];
};
export type StockDistribution = {
  item: StockItem;
  warehouse: Warehouse;
  totalQuantity: string;
  locations: {
    balanceId: string;
    location: StorageLocation;
    quantity: string;
    reserved: string;
    available: string;
  }[];
};
export type StockPage = {
  items: StockPosition[];
  total: number;
  page: number;
  limit: number;
};
export type StockTransferInput = {
  requestKey: string;
  itemId: string;
  fromLocationId: string;
  toLocationId: string;
  quantity: string;
  comment: string;
};
export const warehouseStockApi = {
  warehouses: (query: URLSearchParams, signal?: AbortSignal) =>
    request<{ items: Warehouse[]; total: number; page: number; limit: number }>(
      `/api/warehouse/stock-overview/filters/warehouses?${query}`,
      { signal },
    ),
  storageLocations: (query: URLSearchParams, signal?: AbortSignal) =>
    request<StorageLocationList>(
      `/api/warehouse/stock-overview/filters/storage-locations?${query}`,
      { signal },
    ),
  list: (query: URLSearchParams, signal?: AbortSignal) =>
    request<StockPage>(`/api/warehouse/stock-overview?${query}`, { signal }),
  distribution: (itemId: string, warehouseId: string, signal?: AbortSignal) =>
    request<StockDistribution>(
      `/api/warehouse/stock-overview/items/${itemId}/warehouses/${warehouseId}`,
      { signal },
    ),
  transfer: (input: StockTransferInput) =>
    request<{ id: string }>("/api/warehouse/transfers", {
      method: "POST",
      body: JSON.stringify(input),
    }),
};
