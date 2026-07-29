import type {
  EquipmentEvent as GenericEquipmentEvent,
  EquipmentEventDetail as GenericEquipmentEventDetail,
  EventChecklist,
  EventChecklistAssignment,
  EventChecklistStatus,
  EventCreator,
  EventResponsible,
  EventResponsibleUser,
  EventResponsibleUsersResponse,
  EventSource,
  EventStatus,
} from "../events/events.types";
import type { MaintenanceExecutionType } from "../maintenance/maintenance.types";

export type EquipmentEventStatus = EventStatus;

export type EquipmentEventSource = EventSource;

export type EquipmentEventChecklistStatus = EventChecklistStatus;

export type EquipmentEventResponsible = EventResponsible;

export type EquipmentEventCreator = EventCreator;

export type EquipmentEventChecklist = EventChecklist;

export type EquipmentEventItem = {
  checklists: EquipmentEventChecklist[];
  equipment: {
    id: number;
    model: {
      id: number;
      name: string;
    };
    name: string;
    visibleId: number;
  };
  executionType: MaintenanceExecutionType;
  factDate: string | null;
  id: number;
  maintenanceSettingId: number;
  maintenanceType: {
    code: string;
    id: number;
    name: string;
  };
  note: string | null;
  plannedDate: string | null;
  responsibles: EquipmentEventResponsible[];
  source: EquipmentEventSource;
  status: EquipmentEventStatus;
  version: number;
};

export type EquipmentEventDetail = EquipmentEventItem & {
  createdAt: string;
  createdBy: EquipmentEventCreator;
  equipment: EquipmentEventItem["equipment"] & {
    model: EquipmentEventItem["equipment"]["model"] & {
      manufacturer: {
        id: number;
        name: string;
      };
    };
  };
  originalPlannedDate: string | null;
};

export type EquipmentEventsQuery = {
  dateFrom?: string;
  dateTo?: string;
  equipmentVisibleId?: number;
  limit?: number;
  maintenanceTypeId?: number;
  offset?: number;
  responsibleUserId?: string;
  status?: EquipmentEventStatus;
};

export type CreateManualEquipmentEventPayload = {
  checklistAssignments: EquipmentEventChecklistAssignment[];
  equipmentVisibleId: number;
  maintenanceTypeId: number;
  note?: string | null;
  plannedDate: string;
  responsibleUserIds: string[];
  title?: string;
};

export type EquipmentEventChecklistAssignment = EventChecklistAssignment;

export type UpdateCreatedEquipmentEventPayload = {
  checklistAssignments?: EquipmentEventChecklistAssignment[];
  equipmentVisibleId?: number;
  maintenanceTypeId?: number;
  note?: string | null;
  plannedDate?: string;
  responsibleUserIds?: string[];
  version: number;
};

export type EquipmentEventResponsibleUser = EventResponsibleUser;

export type EquipmentEventResponsibleUsersResponse =
  EventResponsibleUsersResponse;

export type GenericEquipmentEventItem = GenericEquipmentEvent;

export type { GenericEquipmentEventDetail };
