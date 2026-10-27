import { request } from "./api-client";
export type Warehouse = {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
};
export const warehousesApi = {
  list: (query: URLSearchParams, signal?: AbortSignal) =>
    request<{ items: Warehouse[]; total: number; page: number; limit: number }>(
      `/api/warehouse/warehouses?${query}`,
      { signal },
    ),
};
