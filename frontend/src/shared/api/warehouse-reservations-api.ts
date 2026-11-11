import { request } from "./api-client";
import type { OrderData } from "./orders-api";
import type { StockItem } from "./warehouse-stock-api";
import type { StorageLocation } from "./storage-locations-api";

export type Reservation = {
  id: string;
  order: ReservationOrderSummary["order"];
  item: Omit<StockItem, "photo">;
  quantity: string;
  coveredQuantity: string;
  deficitQuantity: string;
  allocations: { id: string; location: StorageLocation; quantity: string }[];
  warnings: { code: string; message: string }[];
};

export type ReservationOrderSummary = {
  order: Pick<OrderData, "id" | "number" | "name" | "status"> & {
    closed: boolean;
    warnings: { code: string; message: string }[];
  };
  positionsCount: number;
  deficitPositionsCount: number;
};
export type ReservationOrdersPage = {
  items: ReservationOrderSummary[];
  total: number;
  page: number;
  limit: number;
};
export type ReservationPlacementInput = {
  locationId: string;
  quantity: string;
};
export type ReservationMoveInput = {
  requestKey: string;
  fromLocationId: string;
  toLocationId: string;
  quantity: string;
  comment: string;
};
const command = (path: string, input: unknown) =>
  request<Reservation>(`/api/warehouse/reservations${path}`, {
    method: "POST",
    body: JSON.stringify(input),
  });
export const warehouseReservationsApi = {
  reserve: (
    input: ReservationPlacementInput & {
      orderId: string;
      itemId: string;
      comment?: string;
    },
  ) => command("", input),
  decrease: (
    id: string,
    input: {
      allocations: ReservationPlacementInput[];
      deficitQuantity: string;
      comment: string;
    },
  ) => command(`/${encodeURIComponent(id)}/decrease`, input),
  reduceCoverage: (
    id: string,
    input: ReservationPlacementInput & { comment: string },
  ) => command(`/${encodeURIComponent(id)}/coverage/reduce`, input),
  restoreCoverage: (
    id: string,
    input: ReservationPlacementInput & { comment: string },
  ) => command(`/${encodeURIComponent(id)}/coverage/restore`, input),
  move: (id: string, input: ReservationMoveInput) =>
    request<{
      reservation: Reservation;
      transfer: { id: string; reservationId: string };
    }>(`/api/warehouse/reservations/${encodeURIComponent(id)}/move`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
  summary: (id: string, signal?: AbortSignal) =>
    request<ReservationOrderSummary>(
      `/api/warehouse/reservations/orders/${encodeURIComponent(id)}/summary`,
      { signal },
    ),
  list: (query: URLSearchParams, signal?: AbortSignal) =>
    request<{
      items: Reservation[];
      total: number;
      page: number;
      limit: number;
    }>(`/api/warehouse/reservations?${query}`, { signal }),
  orders: (query: URLSearchParams, signal?: AbortSignal) =>
    request<ReservationOrdersPage>(
      `/api/warehouse/reservations/orders?${query}`,
      { signal },
    ),
};
