import { useCallback, useState } from "react";
import { getApiErrorMessage } from "../../shared/api/api-error";
import { buildHashRoute } from "../../shared/lib/hash-navigation";
import {
  startChecklistWork,
  type ChecklistWorkListItem,
  type ChecklistWorkStatus,
} from "../../shared/api/checklists";
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
  const [startError, setStartError] = useState<string | null>(null);
  const [startingChecklistId, setStartingChecklistId] = useState<number | null>(
    null,
  );

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

  const startChecklist = useCallback(
    async (item: ChecklistWorkListItem) => {
      setStartError(null);
      setStartingChecklistId(item.id);

      try {
        await startChecklistWork(item.id, {
          version: item.version,
        });
        window.location.hash = getChecklistHref(item.id, "IN_PROGRESS");
      } catch (error) {
        setStartError(getApiErrorMessage(error, "Не удалось начать чек-лист."));
      } finally {
        setStartingChecklistId(null);
      }
    },
    [],
  );

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

      {startError ? <Notice tone="error">{startError}</Notice> : null}

      <section className="admin-card my-checklists-list">
        <MyChecklistsTabs activeTab={activeTab} tabCounts={tabCounts} />

        <MyChecklistsList
          getChecklistHref={getChecklistHref}
          isLoading={checklistList.isLoading}
          items={checklistList.items}
          onStartChecklist={startChecklist}
          startingChecklistId={startingChecklistId}
        />
      </section>
    </div>
  );
}
