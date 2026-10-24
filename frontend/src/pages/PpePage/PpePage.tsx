import { useEffect, useRef, useState } from "react";
import { useMediaQuery } from "../../shared/lib/useMediaQuery";
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
  userPermissions,
  initialTab: requestedTab = "norms",
  employeeId,
  positionId,
}: {
  userPermissions: readonly string[] | null;
  initialTab?: PpeTab;
  employeeId?: number;
  positionId?: number;
}) {
  const returnTo = new URLSearchParams(window.location.hash.split("?")[1] ?? "").get("returnTo");
  const searchReturnTo = returnTo === "#/search" || returnTo?.startsWith("#/search?") ? returnTo : null;
  const initialTab = employeeId ? "issue" : requestedTab === "issue" ? "norms" : requestedTab;
  const [revision, setRevision] = useState(0);
  const isMobile = useMediaQuery("(max-width: 760px)");
  const tabsRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (isMobile) {
      tabsRef.current?.querySelector<HTMLElement>('[aria-current="page"]')
        ?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
    }
  }, [initialTab, isMobile]);
  const allowed = canReadPpe(userPermissions);
  const [journalFiltersRequested, setJournalFiltersRequested] = useState(false);
  const loadJournalReferences =
    initialTab === "journal" && journalFiltersRequested;
  const items = usePpeQuery(
    `ppe-items:${userPermissions}`,
    (signal) => ppeApi.items(signal),
    allowed && (initialTab !== "journal" || loadJournalReferences),
  );
  const employees = usePpeQuery(
    `ppe-employees:${userPermissions}:${employeeId ?? "all"}`,
    (signal) =>
      employeeId
        ? ppeApi.employee(employeeId, signal).then((employee) => [employee])
        : ppeApi.employees(signal),
    allowed && (initialTab === "issue" || loadJournalReferences),
  );
  const positions = usePpeQuery(
    `ppe-positions:${userPermissions}`,
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
  if (!canReadPpe(userPermissions))
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
          ref={tabsRef}
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
                autoFocusSearch={!isMobile}
                items={items.data ?? []}
                referenceState={reference}
                permissions={userPermissions}
                onChanged={catalogChanged}
              />
            )}
            {initialTab === "norms" && (
              <NormsPanel
                autoFocusSearch={!isMobile}
                referenceState={reference}
                positions={positions.data ?? []}
                key={positionId ?? "positions"}
                initialPositionId={positionId}
                onOpenPosition={(id) =>
                  (window.location.hash = `#/ppe/positions/${id}`)
                }
                onBack={() => (window.location.hash = searchReturnTo ?? "#/ppe?tab=norms")}
                items={items.data ?? []}
                permissions={userPermissions}
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
                permissions={userPermissions}
                revision={revision}
                onChanged={changed}
              />
            )}
          </>
        }
        {initialTab === "journal" && (
          <JournalPanel
            autoFocusSearch={!isMobile}
            employees={employees.data ?? []}
            positions={positions.data ?? []}
            items={items.data ?? []}
            onOpenFilters={() => setJournalFiltersRequested(true)}
            referenceState={reference}
            permissions={userPermissions}
            revision={revision}
            onChanged={changed}
          />
        )}
      </section>
    </section>
  );
}
