import { request } from "../api-client";
import type {
  CreateEquipmentPayload,
  EquipmentCard,
  EquipmentCreateOptions,
  EquipmentHistoryItem,
  EquipmentRegistryItem,
  UpdateEquipmentPayload,
} from "./equipment.types";

export function getEquipmentCreateOptions() {
  return request<EquipmentCreateOptions>("/api/equipment/create-options");
}

export function getEquipmentRegistry() {
  return request<EquipmentRegistryItem[]>("/api/equipment");
}

export function getEquipmentCard(visibleId: number) {
  return request<EquipmentCard>(`/api/equipment/${visibleId}`);
}

export function getEquipmentHistory(visibleId: number) {
  return request<EquipmentHistoryItem[]>(`/api/equipment/${visibleId}/history`);
}

export function createEquipment(payload: CreateEquipmentPayload) {
  return request("/api/equipment", {
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
