import { request } from "../api-client";
import type {
  EmployeeSizes,
  PpeEmployee,
  PpeItem,
  PpeItemRecord,
  PpeSize,
  PpePosition,
  NormPayload,
  PpeNorm,
  PpePlan,
  IssueBatch,
  IssueResult,
  IssueFilters,
  PpeIssue,
  SizeRecommendation,
} from "./ppe.types";
const send = <T>(path: string, method: string, payload: unknown) =>
  request<T>(`/api/ppe${path}`, { method, body: JSON.stringify(payload) });
const query = (values: Record<string, string | undefined>) => {
  const params = new URLSearchParams(
    Object.entries(values).filter((entry): entry is [string, string] =>
      Boolean(entry[1]),
    ),
  );
  return params.size ? `?${params}` : "";
};
export const ppeApi = {
  items: (signal?: AbortSignal) =>
    request<PpeItem[]>("/api/ppe/items", { signal }),
  employees: (signal?: AbortSignal) =>
    request<PpeEmployee[]>("/api/ppe/employees", { signal }),
  employee: (id: number, signal?: AbortSignal) =>
    request<PpeEmployee>(`/api/ppe/employees/${id}`, { signal }),
  positions: (signal?: AbortSignal) =>
    request<PpePosition[]>("/api/ppe/positions", { signal }),
  saveItem: (
    id: number | null,
    payload: Pick<PpeItem, "article" | "name" | "unit" | "type"> & {
      sizes?: { value: string; heightValue?: string }[];
    },
  ) =>
    send<PpeItemRecord>(
      id === null ? "/items" : `/items/${id}`,
      id === null ? "POST" : "PUT",
      payload,
    ),
  itemStatus: (id: number, isActive: boolean) =>
    send<PpeItemRecord>(`/items/${id}/status`, "PATCH", { isActive }),
  saveSize: (
    itemId: number,
    id: number | null,
    payload: { value: string; heightValue?: string },
  ) =>
    send<PpeSize>(
      `/items/${itemId}/sizes${id === null ? "" : `/${id}`}`,
      id === null ? "POST" : "PUT",
      payload,
    ),
  sizeStatus: (itemId: number, id: number, isActive: boolean) =>
    send<PpeSize>(`/items/${itemId}/sizes/${id}/status`, "PATCH", { isActive }),
  replaceSizes: (
    itemId: number,
    sizes: { value: string; heightValue?: string }[],
  ) => send<PpeSize[]>(`/items/${itemId}/sizes`, "PUT", { sizes }),
  employeeSizes: (id: number, payload: Partial<EmployeeSizes>) =>
    send<PpeEmployee>(`/employees/${id}/sizes`, "PATCH", payload),
  norms: (positionId?: string, signal?: AbortSignal) =>
    request<PpeNorm[]>(`/api/ppe/norms${query({ positionId })}`, { signal }),
  saveNorm: (
    mode: "create" | "revision" | "edit",
    id: number | null,
    positionId: number,
    payload: NormPayload,
  ) =>
    send<PpeNorm>(
      mode === "create"
        ? "/norms"
        : `/norms/${id}${mode === "revision" ? "/revision" : ""}`,
      mode === "edit" ? "PUT" : "POST",
      mode === "create" ? { ...payload, positionId } : payload,
    ),
  endNorm: (id: number, effectiveTo: string) =>
    send<PpeNorm>(`/norms/${id}/end`, "PATCH", { effectiveTo }),
  deleteNorm: (id: number) =>
    request<{ id: number }>(`/api/ppe/norms/${id}`, { method: "DELETE" }),
  plan: (id: number, issuedAt?: string, signal?: AbortSignal) =>
    request<PpePlan>(
      `/api/ppe/employees/${id}/issues/plan${query({ issuedAt })}`,
      { signal },
    ),
  recommendSize: (employeeId: number, itemId: number, signal?: AbortSignal) =>
    request<SizeRecommendation>(
      `/api/ppe/employees/${employeeId}/items/${itemId}/size-recommendation`,
      { signal },
    ),
  issue: (regular: boolean, payload: IssueBatch) =>
    send<IssueResult[]>(
      `/issues/${regular ? "regular" : "extra"}`,
      "POST",
      payload,
    ),
  journal: (filters: IssueFilters, signal?: AbortSignal) =>
    request<PpeIssue[]>(`/api/ppe/issues${query(filters)}`, { signal }),
  issueDetails: (id: number, signal?: AbortSignal) =>
    request<PpeIssue>(`/api/ppe/issues/${id}`, { signal }),
  cancel: (id: number, reason: string) =>
    send<PpeIssue>(`/issues/${id}/cancel`, "POST", { reason }),
};
