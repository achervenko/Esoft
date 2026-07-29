import type { MaintenanceExecutionType } from "../maintenance/maintenance.types";

export type EventStatus =
  "CREATED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";

export type EventSource = "MANUAL" | "PLANNED";

export type EventExtensionCode = "EQUIPMENT";

export type EventChecklistStatus =
  "CREATED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED" | "INVALIDATED";

export type EventResponsible = {
  fullName: string;
  id: string;
  position: string;
  role: string | null;
};

export type EventCreator = {
  fullName: string;
  id: number;
  position: string;
};

export type EventChecklist = {
  assignedUser: {
    fullName: string;
    id: string;
    position: string;
  };
  assignedUserId: string;
  checklistTemplateId: number;
  id: number;
  progress: {
    answered: number;
    requiredAnswered: number;
    requiredTotal: number;
    total: number;
  };
  sortOrder: number;
  status: EventChecklistStatus;
  templateName: string;
};

export type EventChecklistAssignment = {
  assignedUserId: string;
  checklistTemplateId: number;
};

export type EquipmentEventExtension = {
  code: "EQUIPMENT";
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
  maintenanceSettingId: number;
  maintenanceType: {
    code: string;
    id: number;
    name: string;
  };
};

export type EquipmentEventDetailExtension =
  Omit<EquipmentEventExtension, "equipment"> & {
    equipment: EquipmentEventExtension["equipment"] & {
      model: EquipmentEventExtension["equipment"]["model"] & {
        manufacturer: {
          id: number;
          name: string;
        };
      };
    };
  };

export type EventBase = {
  checklists: EventChecklist[];
  factDate: string | null;
  id: number;
  note: string | null;
  plannedDate: string | null;
  responsibles: EventResponsible[];
  source: EventSource;
  status: EventStatus;
  title: string;
  version: number;
};

export type StandaloneEvent = EventBase & {
  extension: null;
  extensionCode: null;
};

export type EquipmentEvent = EventBase & {
  extension: EquipmentEventExtension;
  extensionCode: "EQUIPMENT";
};

export type Event = StandaloneEvent | EquipmentEvent;

export type StandaloneEventDetail = StandaloneEvent & {
  createdAt: string;
  createdBy: EventCreator;
  originalPlannedDate: string | null;
};

export type EquipmentEventDetail = Omit<EquipmentEvent, "extension"> & {
  createdAt: string;
  createdBy: EventCreator;
  extension: EquipmentEventDetailExtension;
  originalPlannedDate: string | null;
};

export type EventDetail = StandaloneEventDetail | EquipmentEventDetail;

export type EventsQuery = {
  dateFrom?: string;
  dateTo?: string;
  equipmentVisibleId?: number;
  extensionCode?: EventExtensionCode | "NONE";
  limit?: number;
  maintenanceTypeId?: number;
  offset?: number;
  responsibleUserId?: string;
  source?: EventSource;
  status?: EventStatus;
};

type CreateEventBasePayload = {
  checklistAssignments: EventChecklistAssignment[];
  note?: string | null;
  plannedDate: string;
  responsibleUserIds: string[];
  title: string;
};

export type CreateStandaloneEventPayload = CreateEventBasePayload & {
  extension?: never;
  extensionCode?: null;
};

export type CreateEquipmentEventPayload = CreateEventBasePayload & {
  extension: {
    equipmentVisibleId: number;
    maintenanceTypeId: number;
  };
  extensionCode: "EQUIPMENT";
};

export type CreateEventPayload =
  | CreateStandaloneEventPayload
  | CreateEquipmentEventPayload;

export type UpdateCreatedEventPayload = {
  checklistAssignments?: EventChecklistAssignment[];
  extension?: {
    equipmentVisibleId?: number;
    maintenanceTypeId?: number;
  };
  note?: string | null;
  plannedDate?: string;
  responsibleUserIds?: string[];
  title?: string;
  version: number;
};

export type StartEventPayload = {
  version: number;
};

export type CompleteEventPayload = {
  factDate?: string | null;
  version: number;
};

export type CancelEventPayload = {
  version: number;
};

export type EventResponsibleUser = {
  fullName: string;
  position: string;
  role: string | null;
  userId: string;
};

export type EventResponsibleUsersResponse = {
  users: EventResponsibleUser[];
};
