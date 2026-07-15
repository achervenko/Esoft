export type EquipmentViewTab =
  "details" | "documents" | "history" | "maintenance-settings";

const equipmentViewTabs = new Set<EquipmentViewTab>([
  "details",
  "documents",
  "history",
  "maintenance-settings",
]);

export function parseEquipmentViewTab(value: string | null): EquipmentViewTab {
  return value && equipmentViewTabs.has(value as EquipmentViewTab)
    ? (value as EquipmentViewTab)
    : "details";
}
