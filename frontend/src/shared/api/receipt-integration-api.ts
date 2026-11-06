import { request } from "./api-client";
export type IntegrationFlow = {
  flowCode: string;
  name?: string;
  configVersion: number;
  config: Record<string, unknown>;
  isActive: boolean;
  lastSuccessAt: string | null;
  lastErrorAt: string | null;
  lastErrorCode: string | null;
  resultCode?: string | null;
  resultSummary?: {
    documentNumber?: string;
    warehouseName?: string;
    warehouseId?: string;
    documentVersion?: string;
  } | null;
};
export type IntegrationFlowRegistration = {
  flowCode: string;
  name: string;
  systemTypes: string[];
  configVersions: number[];
  incomingActions: string[];
};
export type ReceiptSource = {
  id: string;
  code: string;
  name: string;
  systemType: string;
  baseUrl: string;
  actorUserId: string;
  isActive: boolean;
  flows: IntegrationFlow[];
};
export type ReceiptSourceKey = {
  id: string;
  name: string | null;
  enabled: boolean;
  expiresAt: string | null;
  createdAt: string;
};
export type ReceiptEvent = {
  id: string;
  sourceCode: string;
  sourceName: string;
  flowCode: string;
  status: string;
  objectId: string;
  version: string;
  attempts: number;
  lastErrorCode: string | null;
  resultCode?: string | null;
  resultSummary?: {
    documentNumber?: string;
    warehouseName?: string;
    warehouseId?: string;
    documentVersion?: string;
  } | null;
  nextAttemptAt: string;
  receivedAt: string;
  processedAt: string | null;
};
const base = "/api/integrations";
const sourcePath = (code: string) =>
  `${base}/sources/${encodeURIComponent(code)}`;
export const receiptIntegrationApi = {
  sources: (signal?: AbortSignal) =>
    request<ReceiptSource[]>(`${base}/sources`, { signal }),
  flows: (signal?: AbortSignal) =>
    request<IntegrationFlowRegistration[]>(`${base}/flows`, { signal }),
  configure: async (value: {
    code?: string;
    name: string;
    baseUrl: string;
    authorization: string;
    isActive: boolean;
    flows: IntegrationFlow[];
  }) => {
    const { code, flows, ...body } = value;
    return request<ReceiptSource>(code ? sourcePath(code) : `${base}/sources`, {
      method: code ? "PATCH" : "POST",
      body: JSON.stringify({
        ...body,
        ...(!code ? { systemType: "ONE_C" } : {}),
        flows: flows.map(({ flowCode, configVersion, config, isActive }) => ({
          flowCode,
          configVersion,
          config,
          isActive,
        })),
      }),
    });
  },
  keys: (code: string, signal?: AbortSignal) =>
    request<ReceiptSourceKey[]>(`${sourcePath(code)}/keys`, { signal }),
  createKey: (
    code: string,
    body: { name: string; expiresIn: number; flows: Record<string, string[]> },
  ) =>
    request<{ id: string; key: string }>(`${sourcePath(code)}/keys`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  revoke: (code: string, id: string) =>
    request(`${sourcePath(code)}/keys/${encodeURIComponent(id)}/revoke`, {
      method: "POST",
    }),
  events: (page: number, signal?: AbortSignal, status = "") =>
    request<{ items: ReceiptEvent[]; total: number }>(
      `${base}/events?${new URLSearchParams({ page: String(page), limit: "25", ...(status ? { status } : {}) })}`,
      { signal },
    ),
  retry: (id: string) =>
    request(`${base}/events/${encodeURIComponent(id)}/retry`, {
      method: "POST",
    }),
};
