import { useRef } from "react";
import type { KeyboardEvent } from "react";
import {
  getEquipmentPanelId,
  getEquipmentTabId,
} from "./equipment-card-tab-ids";
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
  const tabRefs = useRef<Record<EquipmentViewTab, HTMLButtonElement | null>>({
    details: null,
    documents: null,
    events: null,
    history: null,
    "maintenance-settings": null,
  });

  const activeIndex = tabConfig.findIndex((tab) => tab.value === activeTab);

  function focusTab(nextIndex: number) {
    const nextTab = tabConfig[nextIndex];

    if (!nextTab) {
      return;
    }

    onTabChange(nextTab.value);
    tabRefs.current[nextTab.value]?.focus();
  }

  function handleKeyDown(
    event: KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) {
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      event.preventDefault();
      focusTab((index + 1) % tabConfig.length);
      return;
    }

    if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      event.preventDefault();
      focusTab((index - 1 + tabConfig.length) % tabConfig.length);
      return;
    }

    if (event.key === "Home") {
      event.preventDefault();
      focusTab(0);
      return;
    }

    if (event.key === "End") {
      event.preventDefault();
      focusTab(tabConfig.length - 1);
    }
  }

  return (
    <div className="equipment-card-tabs" role="tablist">
      {tabConfig.map((tab, index) => (
        <button
          key={tab.value}
          aria-controls={getEquipmentPanelId(tab.value)}
          aria-selected={activeTab === tab.value}
          className={activeTab === tab.value ? "active" : undefined}
          id={getEquipmentTabId(tab.value)}
          tabIndex={activeIndex === index ? 0 : -1}
          onClick={() => onTabChange(tab.value)}
          onKeyDown={(event) => handleKeyDown(event, index)}
          ref={(element) => {
            tabRefs.current[tab.value] = element;
          }}
          role="tab"
          type="button"
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
