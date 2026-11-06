import { request } from "./api-client";
export type ReceiptWarehouseLinks = {
  links: {
    externalId: string;
    warehouseId: string;
    warehouseName: string;
    isActive: boolean;
  }[];
  warehouses: { id: string; name: string }[];
};
const path = (code: string) =>
  `/api/warehouse/integrations/sources/${encodeURIComponent(code)}/warehouses`;
export const receiptIntegrationWarehousesApi = {
  list: (code: string, signal?: AbortSignal) =>
    request<ReceiptWarehouseLinks>(path(code), { signal }),
  save: (code: string, body: { externalId: string; warehouseId: string }) =>
    request(path(code), { method: "PUT", body: JSON.stringify(body) }),
};
