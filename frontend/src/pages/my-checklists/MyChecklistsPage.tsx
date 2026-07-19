import { buildHashRoute } from "../../shared/lib/hash-navigation";
import type { ChecklistWorkStatus } from "../../shared/api/checklists";
import "../../shared/ui/AdminPage.css";
import { Notice } from "../../shared/ui/Notice";
import { MyChecklistsList } from "./components/MyChecklistsList";
import { MyChecklistsTabs } from "./components/MyChecklistsTabs";
import { useMyChecklistsList } from "./hooks/use-my-checklists-list";
import type { ChecklistTabCountMap } from "./my-checklists.types";
import { getActiveTab } from "./my-checklists.utils";
import "./MyChecklistsPage.css";

export type MyChecklistsPageProps = {
  route: string;
};

export function MyChecklistsPage({ route }: MyChecklistsPageProps) {
  const activeTab = getActiveTab(route);

  const checklistList = useMyChecklistsList({
    activeTab,
  });

  const tabCounts: ChecklistTabCountMap = {
    new: checklistList.totalsByStatus.CREATED ?? 0,
    "in-progress": checklistList.totalsByStatus.IN_PROGRESS ?? 0,
  };

  const getChecklistHref = (
    checklistId: number,
    checklistStatus: ChecklistWorkStatus,
  ) =>
    buildHashRoute(`#/my-checklists/${checklistId}`, {
      tab:
        checklistStatus === "CREATED"
          ? null
          : checklistStatus === "IN_PROGRESS"
            ? "in-progress"
            : "completed",
    });

  return (
    <div className="admin-page my-checklists-page">
      <header className="admin-page-header">
        <div>
          <h1>Мои чек-листы</h1>
        </div>
      </header>

      {checklistList.error ? (
        <Notice tone="error">{checklistList.error}</Notice>
      ) : null}

      <section className="admin-card my-checklists-list">
        <MyChecklistsTabs activeTab={activeTab} tabCounts={tabCounts} />

        <MyChecklistsList
          getChecklistHref={getChecklistHref}
          isLoading={checklistList.isLoading}
          items={checklistList.items}
        />
      </section>
    </div>
  );
}
