import type { EquipmentEditTab } from "./equipment-edit-navigation";

type EquipmentEditTabsProps = {
  activeTab: EquipmentEditTab;
  onTabChange: (tab: EquipmentEditTab) => void;
};

export function getEquipmentEditTabId(tab: EquipmentEditTab) {
  return `equipment-edit-tab-${tab}`;
}

export function getEquipmentEditPanelId(tab: EquipmentEditTab) {
  return `equipment-edit-panel-${tab}`;
}

export function EquipmentEditTabs({
  activeTab,
  onTabChange,
}: EquipmentEditTabsProps) {
  return (
    <div className="equipment-edit-tabs" role="tablist">
      <button
        aria-selected={activeTab === "details"}
        aria-controls={getEquipmentEditPanelId("details")}
        className={activeTab === "details" ? "active" : undefined}
        id={getEquipmentEditTabId("details")}
        onClick={() => onTabChange("details")}
        role="tab"
        type="button"
      >
        Данные
      </button>
      <button
        aria-selected={activeTab === "documents"}
        aria-controls={getEquipmentEditPanelId("documents")}
        className={activeTab === "documents" ? "active" : undefined}
        id={getEquipmentEditTabId("documents")}
        onClick={() => onTabChange("documents")}
        role="tab"
        type="button"
      >
        Документы
      </button>
    </div>
  );
}
