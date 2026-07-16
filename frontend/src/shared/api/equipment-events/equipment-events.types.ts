import type { MaintenanceExecutionType } from "../maintenance/maintenance.types";

export type EquipmentEventStatus =
  "CREATED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";

export type EquipmentEventSource = "MANUAL" | "PLANNED";

export type EquipmentEventChecklistStatus =
  "CREATED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED" | "INVALIDATED";

export type EquipmentEventResponsible = {
  fullName: string;
  id: string;
  position: string;
  role: string | null;
};

export type EquipmentEventCreator = {
  fullName: string;
  id: number;
  position: string;
};

export type EquipmentEventChecklist = {
  assignedUserId: string;
  checklistTemplateId: number;
  id: number;
  isRequired: boolean;
  sortOrder: number;
  status: EquipmentEventChecklistStatus;
};

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
  maintenanceSettingId: number | null;
  maintenanceType: {
    code?: string;
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
  originalPlannedDate: string | null;
};

export type EquipmentEventsQuery = {
  limit?: number;
  maintenanceTypeId?: number;
  offset?: number;
  status?: EquipmentEventStatus;
};

export type CreateManualEquipmentEventPayload = {
  checklistAssignments: EquipmentEventChecklistAssignment[];
  equipmentVisibleId: number;
  maintenanceTypeId: number;
  note?: string | null;
  plannedDate: string;
  responsibleUserIds: string[];
};

export type EquipmentEventChecklistAssignment = {
  assignedUserId: string;
  checklistTemplateId: number;
};

export type UpdateCreatedEquipmentEventPayload = {
  equipmentVisibleId?: number;
  maintenanceTypeId?: number;
  note?: string | null;
  plannedDate?: string;
  responsibleUserIds?: string[];
  version: number;
};

export type CompleteEquipmentEventPayload = {
  factDate?: string;
};

export type EquipmentEventResponsibleUser = {
  fullName: string;
  position: string;
  role: string | null;
  userId: string;
};

export type EquipmentEventResponsibleUsersResponse = {
  users: EquipmentEventResponsibleUser[];
};
