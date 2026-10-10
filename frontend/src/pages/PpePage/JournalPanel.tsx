import { LoadingIndicator } from "../../shared/ui/LoadingIndicator";
import { AdminModal } from "../../shared/ui/AdminModal";
import { JournalFiltersModal } from "./JournalFiltersModal";
import { createJournalColumns } from "./journal-columns";
import { searchJournalRows } from "./journal-search";
import "../../shared/ui/SearchInput.css";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { useState, type ComponentProps } from "react";
import {
  ppeApi,
  type IssueFilters,
  type PpeEmployee,
  type PpeItem,
  type PpePosition,
} from "../../shared/api/ppe";
import { DataTable } from "../../shared/ui/DataTable";
import { usePpeQuery } from "../../modules/ppe-ui/usePpeQuery";
import { PpeQueryState } from "../../modules/ppe-ui/PpeQueryState";
import { IssueDetailsModal } from "./IssueDetailsModal";
export function JournalPanel({
  autoFocusSearch = true,
  employees,
  positions,
  items,
  role,
  revision,
  referenceState,
  onOpenFilters,
  onChanged,
}: {
  autoFocusSearch?: boolean;
  employees: PpeEmployee[];
  positions: PpePosition[];
  items: PpeItem[];
  role: string | null;
  revision: number;
  referenceState?: ComponentProps<typeof PpeQueryState>;
  onOpenFilters?: () => void;
  onChanged: () => void;
}) {
  const [search, setSearch] = useState("");
  const [searchConfirmed, setSearchConfirmed] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [applied, setApplied] = useState<IssueFilters>({});
  const [detail, setDetail] = useState<number | null>(null);
  const journal = usePpeQuery(
    `journal:${JSON.stringify(applied)}:${revision}`,
    (signal) => ppeApi.journal(applied, signal),
  );
  const isLoading = journal.loading;
  const activeFilterCount = Object.values(applied).filter(Boolean).length;
  const rows = searchJournalRows(journal.data ?? [], search);
  const columns = createJournalColumns(setDetail);
  return (
    <>
      <div className="admin-card ppe-search-toolbar ppe-journal-toolbar">
        <div className="ppe-journal-search search-input-shell">
          <Search size={18} aria-hidden="true" />
          <input
            autoFocus={autoFocusSearch}
            aria-label="Поиск по журналу"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setSearchConfirmed(false);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                e.preventDefault();
                setSearchConfirmed(true);
              }
            }}
          />
          {search && (
            <button
              type="button"
              className="ppe-journal-icon-button"
              aria-label="Очистить поиск"
              onClick={() => {
                setSearch("");
                setSearchConfirmed(false);
              }}
            >
              <X size={18} aria-hidden="true" />
            </button>
          )}
          <button
            type="button"
            className={`ppe-journal-icon-button ${activeFilterCount ? "ppe-journal-filter-active" : ""}`}
            aria-label="Фильтры"
            title="Фильтры"
            aria-expanded={filtersOpen}
            aria-haspopup="dialog"
            aria-controls="ppe-journal-filters"
            onClick={() => {
              onOpenFilters?.();
              setFiltersOpen(true);
            }}
          >
            <SlidersHorizontal size={20} aria-hidden="true" />
            {activeFilterCount > 0 && (
              <span className="ppe-journal-filter-count">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>
      </div>
      {filtersOpen &&
        (referenceState?.loading || referenceState?.error ? (
          <AdminModal title="Фильтры" onClose={() => setFiltersOpen(false)}>
            <PpeQueryState {...referenceState} />
          </AdminModal>
        ) : (
          <JournalFiltersModal
            applied={applied}
            employees={employees}
            positions={positions}
            items={items}
            onClose={() => setFiltersOpen(false)}
            onApply={(next) => {
              setApplied(next);
              setSearchConfirmed(false);
              setFiltersOpen(false);
            }}
          />
        ))}
      <LoadingIndicator loading={isLoading} />
      <PpeQueryState
        loading={false}
        error={journal.error}
        reload={() => {
          journal.reload();
        }}
      />
      {!isLoading &&
        journal.data &&
        (rows.length ? (
          <div className="admin-card ppe-table-wrap">
            <DataTable
              columns={columns}
              rows={rows}
              defaultSort={{ key: "date", direction: "desc" }}
              getRowKey={(row) => row.id}
              onRowClick={(row) => setDetail(row.id)}
            />
          </div>
        ) : searchConfirmed ? (
          <p className="admin-state">
            {search.trim()
              ? "По вашему запросу ничего не найдено."
              : "Выдач по выбранным фильтрам нет."}
          </p>
        ) : null)}
      {detail !== null && (
        <IssueDetailsModal
          id={detail}
          role={role}
          onClose={() => setDetail(null)}
          onChanged={onChanged}
        />
      )}
    </>
  );
}
