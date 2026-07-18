import { Prisma } from '@prisma/client';
import { type EquipmentEventChecklistAssignment } from './equipment-events.validation';

export type CurrentChecklistState = {
  assignedUserId: string;
  checklistTemplateId: number;
  id: number;
  sortOrder: number;
};

export type CurrentChecklistAssignment = EquipmentEventChecklistAssignment;

export type UpdateCreatedEventChangeInput = {
  currentNote: string | null;
  currentPlannedDate: Date | null;
  currentResponsibleUserIds: string[];
  equipmentId?: number;
  eventTypeId?: number;
  maintenanceSetting?: {
    executionType: Prisma.EquipmentEventUpdateInput['executionType'];
    id: number;
  };
  version: number;
};
