import {
  cancelEvent,
  createEvent,
  getEvent,
  getEventResponsibleUsers,
  getEvents,
  updateCreatedEvent,
} from "../events/events.api";
import type { Event, EventDetail } from "../events/events.types";
import type {
  CreateManualEquipmentEventPayload,
  EquipmentEventDetail,
  EquipmentEventItem,
  EquipmentEventsQuery,
  GenericEquipmentEventDetail,
  GenericEquipmentEventItem,
  UpdateCreatedEquipmentEventPayload,
} from "./equipment-events.types";

export function getEquipmentEvents(
  visibleId: number,
  query: EquipmentEventsQuery = {},
) {
  return getEvents({
    dateFrom: query.dateFrom,
    dateTo: query.dateTo,
    equipmentVisibleId: visibleId,
    extensionCode: "EQUIPMENT",
    limit: query.limit,
    maintenanceTypeId: query.maintenanceTypeId,
    offset: query.offset,
    responsibleUserId: query.responsibleUserId,
    status: query.status,
  }).then((events) =>
    events.map((event) => {
      assertEquipmentEventItem(event);

      return toEquipmentEventItem(event);
    }),
  );
}

export function getEquipmentEvent(eventId: number) {
  return getEvent(eventId).then((event) => {
    assertEquipmentEventDetail(event);

    return toEquipmentEventDetail(event);
  });
}

export function getEquipmentEventResponsibleUsers() {
  return getEventResponsibleUsers();
}

export function createManualEquipmentEvent(
  visibleId: number,
  payload: CreateManualEquipmentEventPayload,
) {
  const equipmentVisibleId = payload.equipmentVisibleId ?? visibleId;

  return createEvent({
    checklistAssignments: payload.checklistAssignments,
    extension: {
      equipmentVisibleId,
      maintenanceTypeId: payload.maintenanceTypeId,
    },
    extensionCode: "EQUIPMENT",
    note: payload.note,
    plannedDate: payload.plannedDate,
    responsibleUserIds: payload.responsibleUserIds,
    title: payload.title ?? buildEquipmentEventTitle(equipmentVisibleId),
  }).then((event) => {
    assertEquipmentEventDetail(event);

    return toEquipmentEventDetail(event);
  });
}

export function updateCreatedEquipmentEvent(
  eventId: number,
  payload: UpdateCreatedEquipmentEventPayload,
) {
  const { equipmentVisibleId, maintenanceTypeId, ...eventPayload } = payload;
  const extension =
    equipmentVisibleId !== undefined || maintenanceTypeId !== undefined
      ? {
          ...(equipmentVisibleId !== undefined ? { equipmentVisibleId } : {}),
          ...(maintenanceTypeId !== undefined ? { maintenanceTypeId } : {}),
        }
      : undefined;

  return updateCreatedEvent(eventId, {
    ...eventPayload,
    ...(extension ? { extension } : {}),
  }).then((event) => {
    assertEquipmentEventDetail(event);

    return toEquipmentEventDetail(event);
  });
}

export function cancelEquipmentEvent(eventId: number, version: number) {
  return cancelEvent(eventId, { version }).then((event) => {
    assertEquipmentEventDetail(event);

    return toEquipmentEventDetail(event);
  });
}

function buildEquipmentEventTitle(equipmentVisibleId: number) {
  return `Событие оборудования ID ${equipmentVisibleId}`;
}

function assertEquipmentEventItem(
  event: Event,
): asserts event is GenericEquipmentEventItem {
  if (event.extensionCode !== "EQUIPMENT" || event.extension === null) {
    throw new Error("Полученное событие не является событием оборудования.");
  }
}

function assertEquipmentEventDetail(
  event: EventDetail,
): asserts event is GenericEquipmentEventDetail {
  if (event.extensionCode !== "EQUIPMENT" || event.extension === null) {
    throw new Error("Полученное событие не является событием оборудования.");
  }
}

function toEquipmentEventItem(
  event: GenericEquipmentEventItem,
): EquipmentEventItem {
  return {
    checklists: event.checklists,
    equipment: event.extension.equipment,
    executionType: event.extension.executionType,
    factDate: event.factDate,
    id: event.id,
    maintenanceSettingId: event.extension.maintenanceSettingId,
    maintenanceType: event.extension.maintenanceType,
    note: event.note,
    plannedDate: event.plannedDate,
    responsibles: event.responsibles,
    source: event.source,
    status: event.status,
    version: event.version,
  };
}

function toEquipmentEventDetail(
  event: GenericEquipmentEventDetail,
): EquipmentEventDetail {
  return {
    ...toEquipmentEventItem(event),
    createdAt: event.createdAt,
    createdBy: event.createdBy,
    equipment: event.extension.equipment,
    originalPlannedDate: event.originalPlannedDate,
  };
}
