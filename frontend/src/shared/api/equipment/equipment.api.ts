import { request } from "../api-client";
import type {
  CreateEquipmentPayload,
  EquipmentCard,
  EquipmentCreateOptions,
  EquipmentHistoryItem,
  EquipmentRegistryItem,
  UpdateEquipmentPayload,
} from "./equipment.types";

export function getEquipmentCreateOptions(visibleId?: number) {
  return request<EquipmentCreateOptions>(
    `/api/equipment/create-options${visibleId === undefined ? "" : `?visibleId=${visibleId}`}`,
  );
}

export function getEquipmentRegistry(query: { page: number; sort: string; direction: string }, signal?: AbortSignal) {
  const params = new URLSearchParams({ page: String(query.page), limit: '100', sort: query.sort, direction: query.direction });
  return request<{ items: EquipmentRegistryItem[]; total: number; page: number; limit: number }>(`/api/equipment?${params}`, { signal });
}

export function getEquipmentCard(visibleId: number) {
  return request<EquipmentCard>(`/api/equipment/${visibleId}`);
}

export function getEquipmentHistory(visibleId: number) {
  return request<EquipmentHistoryItem[]>(`/api/equipment/${visibleId}/history`);
}

export function createEquipment(payload: CreateEquipmentPayload) {
  return request<EquipmentCard>("/api/equipment", {
    body: JSON.stringify(payload),
    method: "POST",
  });
}

export function updateEquipment(
  visibleId: number,
  payload: UpdateEquipmentPayload,
) {
  return request<EquipmentCard>(`/api/equipment/${visibleId}`, {
    body: JSON.stringify(payload),
    method: "PUT",
  });
}
