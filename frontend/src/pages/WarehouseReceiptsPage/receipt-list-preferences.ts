import type { ReceiptListSort } from "./ReceiptListTable";

export type ReceiptListPreferences = {
  sort: ReceiptListSort;
  search: string;
  warehouseId: string;
  source: string;
  states: string[];
  problems: string;
  documentDateFrom: string;
  documentDateTo: string;
};
export const defaultPreferences: ReceiptListPreferences = {
  sort: { key: "receivedAt", direction: "desc" },
  search: "",
  warehouseId: "",
  source: "",
  states: ["RECEIVED", "PLACING"],
  problems: "",
  documentDateFrom: "",
  documentDateTo: "",
};
