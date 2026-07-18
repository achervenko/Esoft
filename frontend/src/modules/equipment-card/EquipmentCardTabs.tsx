import type { EquipmentViewTab } from "./equipment-card-tabs";

type EquipmentCardTabsProps = {
  activeTab: EquipmentViewTab;
  onTabChange: (tab: EquipmentViewTab) => void;
};

const tabConfig: Array<{ label: string; value: EquipmentViewTab }> = [
  { label: "Карточка", value: "details" },
  { label: "Документы", value: "documents" },
  { label: "События", value: "events" },
  { label: "Настройки обслуживания", value: "maintenance-settings" },
  { label: "История изменений", value: "history" },
];

export function EquipmentCardTabs({
  activeTab,
  onTabChange,
}: EquipmentCardTabsProps) {
  return (
    <div className="equipment-card-tabs" role="tablist">
      {tabConfig.map((tab) => (
        <button
          key={tab.value}
          aria-selected={activeTab === tab.value}
          className={activeTab === tab.value ? "active" : undefined}
          onClick={() => onTabChange(tab.value)}
          role="tab"
          type="button"
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
