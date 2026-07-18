import { buildHashRoute } from "../../../shared/lib/hash-navigation";
import { tabConfig } from "../my-checklists.config";
import type { ChecklistTabKey } from "../my-checklists.config";
import type { MyChecklistsTabsProps } from "../my-checklists.types";

export function MyChecklistsTabs({ activeTab }: MyChecklistsTabsProps) {
  return (
    <div className="my-checklists-tablist" role="tablist">
      {(Object.keys(tabConfig) as ChecklistTabKey[]).map((tabKey) => (
        <a
          aria-selected={activeTab === tabKey}
          className={activeTab === tabKey ? "active" : undefined}
          href={buildHashRoute("#/my-checklists", {
            tab: tabKey === "new" ? null : tabKey,
          })}
          key={tabKey}
          role="tab"
        >
          {tabConfig[tabKey].label}
        </a>
      ))}
    </div>
  );
}
