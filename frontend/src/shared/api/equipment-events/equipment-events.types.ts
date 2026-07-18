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
  status: EquipmentEventChecklistStatus;
  templateName: string;
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
};

export type EquipmentEventChecklistAssignment = {
  assignedUserId: string;
  checklistTemplateId: number;
};

export type UpdateCreatedEquipmentEventPayload = {
  checklistAssignments?: EquipmentEventChecklistAssignment[];
  equipmentVisibleId?: number;
  maintenanceTypeId?: number;
  note?: string | null;
  plannedDate?: string;
  responsibleUserIds?: string[];
  version: number;
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
