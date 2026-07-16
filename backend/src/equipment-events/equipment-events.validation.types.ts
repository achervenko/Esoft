import { EquipmentEventStatus } from '@prisma/client';

export type CreateManualEquipmentEventDto = {
  checklistAssignments?: unknown;
  maintenanceTypeId?: unknown;
  note?: unknown;
  plannedDate?: unknown;
  responsibleUserIds?: unknown;
};

export type CompleteEquipmentEventDto = {
  factDate?: unknown;
};

export type UpdateCreatedEquipmentEventDto = {
  equipmentVisibleId?: unknown;
  maintenanceTypeId?: unknown;
  note?: unknown;
  plannedDate?: unknown;
  responsibleUserIds?: unknown;
  version?: unknown;
};

export type EquipmentEventsQueryDto = {
  dateFrom?: unknown;
  dateTo?: unknown;
  equipmentVisibleId?: unknown;
  limit?: unknown;
  maintenanceTypeId?: unknown;
  offset?: unknown;
  responsibleUserId?: unknown;
  status?: unknown;
};

export type CreateManualEquipmentEventData = {
  checklistAssignments: EquipmentEventChecklistAssignment[];
  equipmentVisibleId: number;
  maintenanceTypeId: number;
  note: string | null;
  plannedDate: Date;
  responsibleUserIds: string[];
};

export type EquipmentEventChecklistAssignment = {
  assignedUserId: string;
  checklistTemplateId: number;
};

export type CompleteEquipmentEventData = {
  factDate?: Date;
};

export type UpdateCreatedEquipmentEventData = {
  equipmentVisibleId?: number;
  maintenanceTypeId?: number;
  note?: string | null;
  plannedDate?: Date;
  responsibleUserIds?: string[];
  version: number;
};

export type EquipmentEventsQuery = {
  dateFrom?: Date;
  dateTo?: Date;
  equipmentVisibleId?: number;
  limit: number;
  maintenanceTypeId?: number;
  offset: number;
  responsibleUserId?: string;
  status?: EquipmentEventStatus;
};
