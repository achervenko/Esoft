import { request } from "./api-client";
import { ApiRequestError, getApiErrorMessage } from "./api-error";

export type WarehouseItem = {
  id: string;
  article: string;
  name: string;
  unit: string;
  comment: string | null;
  isActive: boolean;
};
export type WarehouseItemInput = Pick<
  WarehouseItem,
  "article" | "name" | "unit" | "comment"
>;
export type WarehouseCatalogList = {
  items: WarehouseItem[];
  total: number;
  limit: number;
  offset: number;
};
export type WarehouseCatalogError = { message: string; field?: "article" };
export function warehouseCatalogError(error: unknown): WarehouseCatalogError {
  if (error instanceof ApiRequestError) {
    if (error.code === "WAREHOUSE_ARTICLE_EXISTS")
      return {
        message: "Номенклатура с таким артикулом уже существует.",
        field: "article",
      };
    if (error.code === "WAREHOUSE_UNIT_IN_USE")
      return {
        message:
          "Нельзя изменить единицу измерения: позиция уже используется в складских операциях.",
      };
  }
  return { message: getApiErrorMessage(error) };
}
const base = "/api/warehouse/items";
export const warehouseCatalogApi = {
  list: (query: URLSearchParams, signal?: AbortSignal) =>
    request<WarehouseCatalogList>(`${base}?${query}`, { signal }),
  get: (id: string, signal?: AbortSignal) =>
    request<WarehouseItem>(`${base}/${id}`, { signal }),
  create: (input: WarehouseItemInput) =>
    request<WarehouseItem>(base, {
      method: "POST",
      body: JSON.stringify(input),
    }),
  update: (id: string, input: Partial<WarehouseItemInput>) =>
    request<WarehouseItem>(`${base}/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }),
  setStatus: (id: string, isActive: boolean) =>
    request<WarehouseItem>(`${base}/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ isActive }),
    }),
};
