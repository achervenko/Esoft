import type { MaintenanceExecutionType } from "../maintenance/maintenance.types";

export type EquipmentEventStatus =
  | "DRAFT"
  | "CREATED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CANCELLED";

export type EquipmentEventSource = "MANUAL" | "PLANNED";

export type EquipmentEventEmployee = {
  fullName: string;
  id: string;
  position: string;
  role: string | null;
};

export type EquipmentEventItem = {
  checklist: { id: number } | null;
  checklistTemplateId: number | null;
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
  responsibles: EquipmentEventEmployee[];
  source: EquipmentEventSource;
  status: EquipmentEventStatus;
  version: number;
};

export type EquipmentEventDetail = EquipmentEventItem & {
  createdAt: string;
  createdBy: EquipmentEventEmployee;
  originalPlannedDate: string | null;
};

export type EquipmentEventsQuery = {
  limit?: number;
  maintenanceTypeId?: number;
  offset?: number;
  status?: EquipmentEventStatus;
};

export type CreateManualEquipmentEventPayload = {
  maintenanceTypeId: number;
  note?: string | null;
  plannedDate: string;
  responsibleUserIds: string[];
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
