import { canReadEquipment } from "../../modules/equipment-permissions/equipment-permissions";
import { canReadPpe } from "../../modules/ppe-permissions/ppe-permissions";
export const searchModules = [
  { id: "equipment", label: "Оборудование", canRead: canReadEquipment },
  { id: "ppe", label: "СИЗ", canRead: canReadPpe },
];
export function availableSearchModules(permissions: unknown) {
  return searchModules.filter((module) => module.canRead(permissions));
}
export function permittedModuleFilter(value: string | null, permissions: unknown) {
  const available = availableSearchModules(permissions);
  const selected = available.filter((module) => value?.split(",").includes(module.id));
  return selected.length && selected.length < available.length ? selected.map((module) => module.id).join(",") : "";
}
