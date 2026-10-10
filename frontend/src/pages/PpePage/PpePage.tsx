import { useState } from "react";
import { ppeApi } from "../../shared/api/ppe";
import { canReadPpe } from "../../modules/ppe-permissions/ppe-permissions";
import { Message } from "../../modules/ppe-ui/ppe-ui";
import { usePpeQuery } from "../../modules/ppe-ui/usePpeQuery";
import { CatalogPanel } from "./CatalogPanel";
import { NormsPanel } from "./NormsPanel";
import { IssuePanel } from "./IssuePanel";
import { JournalPanel } from "./JournalPanel";
import "../../shared/ui/AdminPage.css";
import "./PpePage.css";
const ppeTabs = {
  norms: "Нормы",
  catalog: "Номенклатура",
  journal: "Журнал",
} as const;
export type PpeTab = keyof typeof ppeTabs | "issue";

export function PpePage({
  userRole,
  initialTab: requestedTab = "norms",
  employeeId,
  positionId,
}: {
  userRole: string | null;
  initialTab?: PpeTab;
  employeeId?: number;
  positionId?: number;
}) {
  const returnTo = new URLSearchParams(window.location.hash.split("?")[1] ?? "").get("returnTo");
  const searchReturnTo = returnTo === "#/search" || returnTo?.startsWith("#/search?") ? returnTo : null;
  const initialTab = employeeId ? "issue" : requestedTab === "issue" ? "norms" : requestedTab;
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
      className={`admin-page ppe-page ${!employeeId && !positionId ? "ppe-list-page" : ""} ${employeeId || positionId ? "ppe-employee-page" : ""}`}
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
              onMouseDown={(event) => {
                // Keep search focused until the new tab's search takes over.
                if (event.button === 0) event.preventDefault();
              }}
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
            : "ppe-list-content"
        }
      >
        {
          <>
            {initialTab === "catalog" && (
              <CatalogPanel
                items={items.data ?? []}
                referenceState={reference}
                role={userRole}
                onChanged={catalogChanged}
              />
            )}
            {initialTab === "norms" && (
              <NormsPanel
                referenceState={reference}
                positions={positions.data ?? []}
                key={positionId ?? "positions"}
                initialPositionId={positionId}
                onOpenPosition={(id) =>
                  (window.location.hash = `#/ppe/positions/${id}`)
                }
                onBack={() => (window.location.hash = searchReturnTo ?? "#/ppe?tab=norms")}
                items={items.data ?? []}
                role={userRole}
                revision={revision}
                onChanged={catalogChanged}
              />
            )}
            {initialTab === "issue" && (
              <IssuePanel
                referenceState={reference}
                employees={employees.data ?? []}
                key={employeeId ?? "search"}
                initialEmployeeId={employeeId}
                onBack={() => {
                  window.location.hash = searchReturnTo ?? "#/search";
                }}
                items={items.data ?? []}
                role={userRole}
                revision={revision}
                onChanged={changed}
              />
            )}
          </>
        }
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
