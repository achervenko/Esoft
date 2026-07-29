import type {
  EquipmentEventDetail,
  EquipmentEventItem,
} from "./equipment-events.types";

export type EquipmentEventsPanelActiveForm =
  | { mode: "create"; event?: null }
  | { mode: "edit"; event: EquipmentEventItem };

export type EquipmentEventsPanelModalState = {
  activeForm: EquipmentEventsPanelActiveForm | null;
  cancelCandidate: EquipmentEventItem | null;
  detailEvent: EquipmentEventDetail | null;
};
