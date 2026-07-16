import type {
  EquipmentEventDetail,
  EquipmentEventItem,
} from "../../shared/api/equipment-events/equipment-events.types";

export type EquipmentEventsPanelActiveForm =
  | { mode: "create"; event?: null }
  | { mode: "edit"; event: EquipmentEventItem };

export type EquipmentEventsPanelModalState = {
  activeForm: EquipmentEventsPanelActiveForm | null;
  cancelCandidate: EquipmentEventItem | null;
  completeCandidate: EquipmentEventItem | null;
  detailEvent: EquipmentEventDetail | null;
};
