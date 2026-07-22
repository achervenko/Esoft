import { buildHashRoute } from "../../shared/lib/hash-navigation";

export type EquipmentEditTab = "details" | "documents";

export function buildEquipmentViewHref(
  visibleId: number,
  activeTab: EquipmentEditTab,
  returnTo: string,
) {
  return buildHashRoute(`#/equipment/${visibleId}`, {
    returnTo,
    tab: activeTab === "documents" ? "documents" : null,
  });
}
