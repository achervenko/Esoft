import { request } from "./api-client";

export type ReceiptStatus = "RECEIVED" | "PLACING" | "PLACED" | "CANCELLED";
export type ReceiptSummary = {
  id: string;
  warehouseId: string | null;
  warehouseNameSnapshot: string | null;
  source: "MANUAL" | "ONE_C";
  sourceSystem: string;
  status: ReceiptStatus;
  documentNumber: string | null;
  documentDate: string | null;
  createdAt: string;
  receivedAt: string;
  totalQuantity: string;
  placedQuantity: string;
  lineCount: number;
  placedLineCount: number;
  hasProblems: boolean;
  unmappedLineCount?: number;
  hasReconciliationCandidates?: boolean;
  conflict: string | null;
};
export type ReceiptLine = {
  id: string;
  itemId: string | null;
  article: string | null;
  sourceArticle?: string | null;
  order?: { id: string; number: string | null; name: string | null } | null;
  name: string;
  unit: string;
  quantity: string;
  placed: string;
  remaining: string;
  sourceType: string;
  reconciledToLineId: string | null;
  mappingStatus: "MAPPED" | "UNMAPPED";
  placements: {
    id: string;
    storageLocationId: string;
    quantity: string;
    location: { name?: string };
    createdAt: string;
  }[];
};
export type Receipt = ReceiptSummary & {
  settlementAdjustments?: { id: string; quantity: string; type: string }[];
  sourceVersion: string | null;
  comment: string | null;
  lines: ReceiptLine[];
  sourceDocument: unknown;
  pendingSourceDocument: unknown;
};
export type ReceiptPage = {
  items: ReceiptSummary[];
  total: number;
  page: number;
  limit: number;
};
export type ReceiptReconciliationCandidate = {
  id: string;
  status: "PLACING" | "PLACED";
  documentNumber: string | null;
  documentDate: string | null;
  sameNumber: boolean;
  sameItems: boolean;
  sameQuantities: boolean;
  matchedItems: number;
  manualItems: number;
  dateDistance: number | null;
};
const base = "/api/warehouse/receipts";
const post = <T>(path: string, body: unknown) =>
  request<T>(path, { method: "POST", body: JSON.stringify(body) });
export const receiptsApi = {
  reconciliationCandidates: (id: string, signal?: AbortSignal) =>
    request<{ items: ReceiptReconciliationCandidate[] }>(
      `${base}/${id}/reconciliation-candidates`,
      { signal },
    ),
  list: (query: URLSearchParams, signal?: AbortSignal) =>
    request<ReceiptPage>(`${base}?${query}`, { signal }),
  get: (id: string, signal?: AbortSignal) =>
    request<Receipt>(`${base}/${id}`, { signal }),
  create: (body: {
    requestKey: string;
    warehouseId: string;
    documentNumber?: string;
    documentDate?: string;
    comment?: string;
    newItems?: {
      draftId: string;
      item: { article: string; name: string; unit: string };
    }[];
    lines: ((
      { itemId: string; draftId?: never } | { draftId: string; itemId?: never }
    ) & { quantity: string })[];
  }) => post<Receipt>(base, body),
  cancel: (id: string) => post(`${base}/${id}/cancel`, {}),
  place: (
    id: string,
    lineId: string,
    body: { requestKey: string; storageLocationId: string; quantity: string },
  ) => post(`${base}/${id}/lines/${lineId}/placements`, body),
  mapItem: (
    id: string,
    lineId: string,
    body:
      | { itemId: string }
      | { create: { article: string; name: string; unit: string } },
  ) => post(`${base}/${id}/lines/${lineId}/item-link`, body),
  reconcile: (
    id: string,
    body: {
      manualReceiptId: string;
      lines: { manualLineId: string; receiptLineId: string }[];
    },
  ) => post(`${base}/${id}/reconcile`, body),
  resolve: (
    id: string,
    body: {
      action: "KEEP_CURRENT" | "ACCEPT_CANCELLATION" | "RECONCILE_CANCELLATION";
      adjustmentIds?: string[];
      reason: string;
      sourceVersion: string;
    },
  ) => post(`${base}/${id}/resolve-conflict`, body),
};
