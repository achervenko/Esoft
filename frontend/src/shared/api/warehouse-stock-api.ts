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
export type StockReservationQuantities = {
  reservedQuantity: string;
  freeQuantity: string;
  reservationMismatch: boolean;
};
export type StockPosition = StockReservationQuantities & {
  id: string;
  item: StockItem;
  warehouse: Warehouse;
  quantity: string;
  locationsCount: number;
  locationsPreview: (StockReservationQuantities & {
    location: StorageLocation;
    quantity: string;
  })[];
};
export type StockDistribution = StockReservationQuantities & {
  item: StockItem;
  warehouse: Warehouse;
  totalQuantity: string;
  locations: (StockReservationQuantities & {
    balanceId: string;
    location: StorageLocation;
    quantity: string;
  })[];
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
export type StockConsolidationInput = {
  requestKey: string;
  itemId: string;
  fromWarehouseId: string;
  toLocationId: string;
  moves: { fromLocationId: string; quantity: string }[];
};
export type StockAdjustmentInput = {
  requestKey: string;
  itemId: string;
  locationId: string;
  actualQuantity: string;
  expectedQuantity: string;
  reason: string;
  attachments: string[];
};
export const warehouseStockApi = {
  currentUserId: async () => {
    const session = await request<{ user: { id: string } } | null>(
      "/api/auth/get-session",
    );
    if (!session?.user.id)
      throw new Error("Войдите в систему для подтверждения перемещения.");
    return session.user.id;
  },
  uploadAdjustmentDocument: (file: File) => {
    const body = new FormData();
    body.append("file", file);
    return request<{ uploadId: string; originalName: string }>(
      "/api/warehouse/adjustments/documents",
      { method: "POST", body, signal: AbortSignal.timeout(120_000) },
    );
  },
  adjust: (input: StockAdjustmentInput) =>
    request("/api/warehouse/adjustments", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  consolidate: (input: StockConsolidationInput) =>
    request<{ ids: string[] }>("/api/warehouse/transfers/consolidate", {
      method: "POST",
      body: JSON.stringify(input),
    }),
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
