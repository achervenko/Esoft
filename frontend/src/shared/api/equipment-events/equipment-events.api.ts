import { request } from "../api-client";
import type {
  CreateManualEquipmentEventPayload,
  EquipmentEventDetail,
  EquipmentEventItem,
  EquipmentEventResponsibleUsersResponse,
  EquipmentEventsQuery,
  UpdateCreatedEquipmentEventPayload,
} from "./equipment-events.types";

export function getEquipmentEvents(
  visibleId: number,
  query: EquipmentEventsQuery = {},
) {
  const searchParams = new URLSearchParams();

  searchParams.set("equipmentVisibleId", String(visibleId));

  if (query.maintenanceTypeId !== undefined) {
    searchParams.set("maintenanceTypeId", String(query.maintenanceTypeId));
  }

  if (query.dateFrom) {
    searchParams.set("dateFrom", query.dateFrom);
  }

  if (query.dateTo) {
    searchParams.set("dateTo", query.dateTo);
  }

  if (query.responsibleUserId) {
    searchParams.set("responsibleUserId", query.responsibleUserId);
  }

  if (query.status) {
    searchParams.set("status", query.status);
  }

  if (query.limit !== undefined) {
    searchParams.set("limit", String(query.limit));
  }

  if (query.offset !== undefined) {
    searchParams.set("offset", String(query.offset));
  }

  return request<EquipmentEventItem[]>(
    `/api/equipment-events?${searchParams.toString()}`,
  );
}

export function getEquipmentEvent(eventId: number) {
  return request<EquipmentEventDetail>(`/api/equipment-events/${eventId}`);
}

export function getEquipmentEventResponsibleUsers() {
  return request<EquipmentEventResponsibleUsersResponse>(
    "/api/equipment-events/responsible-users",
  );
}

export function createManualEquipmentEvent(
  visibleId: number,
  payload: CreateManualEquipmentEventPayload,
) {
  return request<EquipmentEventDetail>(
    `/api/equipment/${visibleId}/events/manual`,
    {
      body: JSON.stringify(payload),
      method: "POST",
    },
  );
}

export function updateCreatedEquipmentEvent(
  eventId: number,
  payload: UpdateCreatedEquipmentEventPayload,
) {
  return request<EquipmentEventDetail>(`/api/equipment-events/${eventId}`, {
    body: JSON.stringify(payload),
    method: "PATCH",
  });
}

export function cancelEquipmentEvent(eventId: number) {
  return request<EquipmentEventDetail>(
    `/api/equipment-events/${eventId}/cancel`,
    {
      method: "POST",
    },
  );
}
