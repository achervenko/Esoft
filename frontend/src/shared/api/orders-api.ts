import { request } from "./api-client";
export type OrderData = {
  id: string;
  sourceId: string;
  externalId: string | null;
  number: string;
  name: string;
  documentDate: string;
  status: string;
  posted: boolean;
  deletionMark: boolean;
  missingChecks: number;
  checkedAt: string;
  changedAt: string;
  source: { name: string };
};
export type OrderSyncRun = {
  id: string;
  startedAt: string;
  finishedAt: string;
  outcome: string;
  received: number | null;
  changed: number | null;
  errorCode: string | null;
};
export type OrderSource = {
  runs: OrderSyncRun[];
  id: string;
  name: string;
  isActive: boolean;
  lastSuccessAt: string | null;
  lastErrorAt: string | null;
  lastErrorCode: string | null;
};
export type OrderChange = {
  id: string;
  observedAt: string;
  before:
    | (Omit<
        OrderData,
        | "id"
        | "sourceId"
        | "source"
        | "checkedAt"
        | "changedAt"
        | "missingChecks"
      > & { missing?: boolean })
    | null;
  after: NonNullable<OrderChange["before"]>;
};
export type OrdersPageResult<T> = {
  items: T[];
  total: number;
  page: number;
  limit: number;
};
export const ordersApi = {
  list: (params: URLSearchParams, signal?: AbortSignal) =>
    request<OrdersPageResult<OrderData> & { statuses: string[] }>(
      `/api/orders?${params}`,
      { signal },
    ),
  sources: (signal?: AbortSignal) =>
    request<OrderSource[]>("/api/orders/sources", { signal }),
  detail: (id: string, signal?: AbortSignal) =>
    request<OrderData>(`/api/orders/${encodeURIComponent(id)}`, { signal }),
  history: (id: string, page: number, signal?: AbortSignal) =>
    request<OrdersPageResult<OrderChange>>(
      `/api/orders/${encodeURIComponent(id)}/history?page=${page}&limit=20`,
      { signal },
    ),
  refresh: (id: string) =>
    request<{
      outcome: "SUCCESS" | "BUSY";
      received?: number;
      changed?: number;
    }>(`/api/orders/sources/${encodeURIComponent(id)}/refresh`, {
      method: "POST",
    }),
};
export const orderTitle = (row: Pick<OrderData, "number" | "name">) =>
  row.name.trim() || `Заказ №${row.number}`;
