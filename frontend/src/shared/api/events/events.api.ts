import { request } from "../api-client";
import type {
  CreateEventPayload,
  CompleteEventPayload,
  CancelEventPayload,
  Event,
  EventDetail,
  EventResponsibleUsersResponse,
  EventsQuery,
  StartEventPayload,
  UpdateCreatedEventPayload,
} from "./events.types";

export function getEvents(query: EventsQuery = {}) {
  const searchParams = new URLSearchParams();

  appendQueryParam(searchParams, "dateFrom", query.dateFrom);
  appendQueryParam(searchParams, "dateTo", query.dateTo);
  appendQueryParam(
    searchParams,
    "equipmentVisibleId",
    query.equipmentVisibleId,
  );
  appendQueryParam(searchParams, "extensionCode", query.extensionCode);
  appendQueryParam(searchParams, "limit", query.limit);
  appendQueryParam(
    searchParams,
    "maintenanceTypeId",
    query.maintenanceTypeId,
  );
  appendQueryParam(searchParams, "offset", query.offset);
  appendQueryParam(
    searchParams,
    "responsibleUserId",
    query.responsibleUserId,
  );
  appendQueryParam(searchParams, "source", query.source);
  appendQueryParam(searchParams, "status", query.status);

  const queryString = searchParams.toString();

  return request<Event[]>(`/api/events${queryString ? `?${queryString}` : ""}`);
}

export function getEvent(eventId: number) {
  return request<EventDetail>(`/api/events/${eventId}`);
}

export function getEventResponsibleUsers() {
  return request<EventResponsibleUsersResponse>(
    "/api/events/responsible-users",
  );
}

export function createEvent(payload: CreateEventPayload) {
  return request<EventDetail>("/api/events", {
    body: JSON.stringify(payload),
    method: "POST",
  });
}

export function updateCreatedEvent(
  eventId: number,
  payload: UpdateCreatedEventPayload,
) {
  return request<EventDetail>(`/api/events/${eventId}`, {
    body: JSON.stringify(payload),
    method: "PATCH",
  });
}

export function startEvent(eventId: number, payload: StartEventPayload) {
  return request<EventDetail>(`/api/events/${eventId}/start`, {
    body: JSON.stringify(payload),
    method: "POST",
  });
}

export function completeEvent(
  eventId: number,
  payload: CompleteEventPayload,
) {
  return request<EventDetail>(`/api/events/${eventId}/complete`, {
    body: JSON.stringify(payload),
    method: "POST",
  });
}

export function cancelEvent(eventId: number, payload: CancelEventPayload) {
  return request<EventDetail>(`/api/events/${eventId}/cancel`, {
    body: JSON.stringify(payload),
    method: "POST",
  });
}

function appendQueryParam(
  searchParams: URLSearchParams,
  key: keyof EventsQuery,
  value: EventsQuery[keyof EventsQuery],
) {
  if (value !== undefined && value !== "") {
    searchParams.set(key, String(value));
  }
}
