import { request } from "./api-client";
export type Warehouse = {
  id: string;
  name: string;
  isActive: boolean;
};
export const warehousesApi = {
  create: (input: { name: string }) =>
    request<Warehouse>("/api/warehouse/warehouses", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  update: (id: string, input: Partial<Pick<Warehouse, "name" | "isActive">>) =>
    request<Warehouse>(`/api/warehouse/warehouses/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }),
  list: (query: URLSearchParams, signal?: AbortSignal) =>
    request<{ items: Warehouse[]; total: number; page: number; limit: number }>(
      `/api/warehouse/warehouses?${query}`,
      { signal },
    ),
};
