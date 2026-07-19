import { buildHashRoute } from "../../../shared/lib/hash-navigation";
import { checklistTabOrder, tabConfig } from "../my-checklists.config";
import type { MyChecklistsTabsProps } from "../my-checklists.types";

export function MyChecklistsTabs({
  activeTab,
  tabCounts,
}: MyChecklistsTabsProps) {
  return (
    <div className="my-checklists-tablist" role="tablist">
      {checklistTabOrder.map((tabKey) => (
        <a
          aria-selected={activeTab === tabKey}
          className={activeTab === tabKey ? "active" : undefined}
          href={buildHashRoute("#/my-checklists", {
            tab: tabKey === "new" ? null : tabKey,
          })}
          key={tabKey}
          role="tab"
        >
          <span>{tabConfig[tabKey].label}</span>
          {tabCounts[tabKey] ? (
            <span className="my-checklists-tab-badge">{tabCounts[tabKey]}</span>
          ) : null}
        </a>
      ))}
    </div>
  );
}
