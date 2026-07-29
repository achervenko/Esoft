import type {
  EquipmentEvent as GenericEquipmentEvent,
  EquipmentEventDetail as GenericEquipmentEventDetail,
  Event,
  EventDetail,
} from "../../shared/api/events/events.types";
import type {
  EquipmentEventDetail,
  EquipmentEventItem,
} from "./equipment-events.types";

export function buildEquipmentEventTitle(equipmentVisibleId: number) {
  return `Событие оборудования ID ${equipmentVisibleId}`;
}

export function assertEquipmentEventItem(
  event: Event,
): asserts event is GenericEquipmentEvent {
  if (event.extensionCode !== "EQUIPMENT" || event.extension === null) {
    throw new Error("Полученное событие не является событием оборудования.");
  }
}

export function assertEquipmentEventDetail(
  event: EventDetail,
): asserts event is GenericEquipmentEventDetail {
  if (event.extensionCode !== "EQUIPMENT" || event.extension === null) {
    throw new Error("Полученное событие не является событием оборудования.");
  }
}

export function toEquipmentEventItem(
  event: GenericEquipmentEvent,
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

export function toEquipmentEventDetail(
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
