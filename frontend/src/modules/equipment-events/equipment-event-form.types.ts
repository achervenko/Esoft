import type {
  EquipmentEventChecklistAssignment,
  UpdateCreatedEquipmentEventPayload,
} from "./equipment-events.types";

export type EquipmentEventFormMode = "create" | "edit";

export type EquipmentEventFormPayload = {
  checklistAssignments: EquipmentEventChecklistAssignment[];
  maintenanceTypeId: number;
  note: string | null;
  plannedDate: string;
  responsibleUserIds: string[];
  updatePayload?: UpdateCreatedEquipmentEventPayload;
};

export type ResponsibleUserOption = {
  id: string;
  isUnavailable?: boolean;
  name: string;
  position: string;
};
