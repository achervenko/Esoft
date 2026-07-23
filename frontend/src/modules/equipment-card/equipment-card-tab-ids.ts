import type { EquipmentViewTab } from "./equipment-card-tabs";

export function getEquipmentTabId(tab: EquipmentViewTab) {
  return `equipment-tab-${tab}`;
}

export function getEquipmentPanelId(tab: EquipmentViewTab) {
  return `equipment-panel-${tab}`;
}
