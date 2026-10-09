import { useState } from "react";
import { navigateWithViewTransition } from "../../shared/lib/view-transition-navigation";
import { ppeApi } from "../../shared/api/ppe";
import { canReadPpe } from "../../modules/ppe-permissions/ppe-permissions";
import { Message } from "../../modules/ppe-ui/ppe-ui";
import { usePpeQuery } from "../../modules/ppe-ui/usePpeQuery";
import { PpeQueryState } from "../../modules/ppe-ui/PpeQueryState";
import { CatalogPanel } from "./CatalogPanel";
import { NormsPanel } from "./NormsPanel";
import { IssuePanel } from "./IssuePanel";
import { JournalPanel } from "./JournalPanel";
import "../../shared/ui/AdminPage.css";
import "./PpePage.css";
const ppeTabs = {
  issue: "Карточка сотрудника",
  norms: "Нормы",
  catalog: "Номенклатура",
  journal: "Журнал",
} as const;
export type PpeTab = keyof typeof ppeTabs;

export function PpePage({
  userRole,
  initialTab = "issue",
  employeeId,
  positionId,
}: {
  userRole: string | null;
  initialTab?: PpeTab;
  employeeId?: number;
  positionId?: number;
}) {
  const [revision, setRevision] = useState(0);
  const allowed = canReadPpe(userRole);
  const [journalFiltersRequested, setJournalFiltersRequested] = useState(false);
  const loadJournalReferences =
    initialTab === "journal" && journalFiltersRequested;
  const items = usePpeQuery(
    `ppe-items:${userRole}`,
    (signal) => ppeApi.items(signal),
    allowed && (initialTab !== "journal" || loadJournalReferences),
  );
  const employees = usePpeQuery(
    `ppe-employees:${userRole}`,
    (signal) => ppeApi.employees(signal),
    allowed && (initialTab === "issue" || loadJournalReferences),
  );
  const positions = usePpeQuery(
    `ppe-positions:${userRole}`,
    (signal) => ppeApi.positions(signal),
    allowed && (initialTab === "norms" || loadJournalReferences),
  );
  const required =
    initialTab === "catalog"
      ? [items]
      : initialTab === "norms"
        ? [items, positions]
        : initialTab === "issue"
          ? [items, employees]
          : loadJournalReferences
            ? [items, employees, positions]
            : [];
  const reference = {
    loading: required.some(
      (query) => query.loading || (!query.data && !query.error),
    ),
    error: required.find((query) => query.error)?.error ?? null,
    reload: () =>
      required
        .filter((query) => query.error || !query.data)
        .forEach((query) => query.reload()),
  };
  const ready = required.every((query) => query.data !== null);
  const changed = () => setRevision((value) => value + 1);
  const catalogChanged = () => {
    items.reload();
    changed();
  };
  if (!canReadPpe(userRole))
    return (
      <section className="admin-page">
        <Message error="Недостаточно прав для просмотра СИЗ." />
      </section>
    );
  return (
    <section
      className={`admin-page ppe-page ${initialTab === "journal" ? "ppe-journal-page" : ""} ${employeeId || positionId ? "ppe-employee-page equipment-view-page" : ""}`}
    >
      {!employeeId && !positionId && (
        <header className="admin-page-header">
          <div>
            <h1>СИЗ</h1>
          </div>
        </header>
      )}
      {!employeeId && !positionId && (
        <nav
          className="equipment-edit-tabs admin-tabs ppe-tabs"
          aria-label="Разделы СИЗ"
        >
          {Object.entries(ppeTabs).map(([key, label]) => (
            <a
              key={key}
              href={`#/ppe?tab=${key}`}
              aria-current={initialTab === key ? "page" : undefined}
              className={initialTab === key ? "active" : undefined}
            >
              {label}
            </a>
          ))}
        </nav>
      )}
      <section
        className={
          employeeId || positionId
            ? "ppe-employee-content"
            : initialTab === "journal"
              ? "ppe-journal-content"
              : "admin-card"
        }
      >
        {initialTab !== "journal" && <PpeQueryState {...reference} />}
        {ready && (
          <>
            {initialTab === "catalog" && (
              <CatalogPanel
                items={items.data ?? []}
                role={userRole}
                onChanged={catalogChanged}
              />
            )}
            {initialTab === "norms" && (
              <NormsPanel
                positions={positions.data ?? []}
                key={positionId ?? "positions"}
                initialPositionId={positionId}
                onOpenPosition={(id) =>
                  navigateWithViewTransition(`#/ppe/positions/${id}`)
                }
                onBack={() => navigateWithViewTransition("#/ppe?tab=norms")}
                items={items.data ?? []}
                role={userRole}
                revision={revision}
                onChanged={catalogChanged}
              />
            )}
            {initialTab === "issue" && (
              <IssuePanel
                employees={employees.data ?? []}
                key={employeeId ?? "search"}
                initialEmployeeId={employeeId}
                onOpenEmployee={(id) => {
                  navigateWithViewTransition(`#/ppe/employees/${id}`);
                }}
                onBack={() => {
                  navigateWithViewTransition("#/ppe");
                }}
                items={items.data ?? []}
                role={userRole}
                revision={revision}
                onChanged={changed}
              />
            )}
          </>
        )}
        {initialTab === "journal" && (
          <JournalPanel
            employees={employees.data ?? []}
            positions={positions.data ?? []}
            items={items.data ?? []}
            onOpenFilters={() => setJournalFiltersRequested(true)}
            referenceState={reference}
            role={userRole}
            revision={revision}
            onChanged={changed}
          />
        )}
      </section>
    </section>
  );
}
