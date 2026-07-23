import type { EquipmentEditTab } from "./equipment-edit-navigation";

export function getEquipmentEditTabId(tab: EquipmentEditTab) {
  return `equipment-edit-tab-${tab}`;
}

export function getEquipmentEditPanelId(tab: EquipmentEditTab) {
  return `equipment-edit-panel-${tab}`;
}
