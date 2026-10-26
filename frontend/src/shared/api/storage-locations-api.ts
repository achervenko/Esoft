import { request } from "./api-client";
export type StorageLocation = {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
};
export type StorageLocationInput = Omit<StorageLocation, "id">;
export type StorageLocationList = {
  items: StorageLocation[];
  total: number;
  page: number;
  limit: number;
};
const base = "/api/warehouse/storage-locations";
export const storageLocationsApi = {
  get: (id: string) =>
    request<StorageLocation & { hasStock: boolean }>(`${base}/${id}`),
  list: (query: URLSearchParams, signal?: AbortSignal) =>
    request<StorageLocationList>(`${base}?${query}`, { signal }),
  create: (data: StorageLocationInput) =>
    request<StorageLocation>(base, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  update: (id: string, data: Partial<StorageLocationInput>) =>
    request<StorageLocation>(`${base}/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
};
