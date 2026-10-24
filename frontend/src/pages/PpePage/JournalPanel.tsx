import { LoadingIndicator } from "../../shared/ui/LoadingIndicator";
import { AdminModal } from "../../shared/ui/AdminModal";
import { JournalFiltersModal } from "./JournalFiltersModal";
import { createJournalColumns } from "./journal-columns";
import "../../shared/ui/SearchInput.css";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { useEffect, useMemo, useState, type ComponentProps } from "react";
import {
  ppeApi,
  type IssueFilters,
  type PpeEmployee,
  type PpeItem,
  type PpePosition,
} from "../../shared/api/ppe";
import { DataTable, type DataTableSortDirection } from "../../shared/ui/DataTable";
import { PageNavigation } from "../../shared/ui/PageNavigation";
import { usePpeQuery } from "../../modules/ppe-ui/usePpeQuery";
import { PpeQueryState } from "../../modules/ppe-ui/PpeQueryState";
import { IssueDetailsModal } from "./IssueDetailsModal";
export function JournalPanel({
  autoFocusSearch = true,
  employees,
  positions,
  items,
  permissions,
  revision,
  referenceState,
  onOpenFilters,
  onChanged,
}: {
  autoFocusSearch?: boolean;
  employees: PpeEmployee[];
  positions: PpePosition[];
  items: PpeItem[];
  permissions: readonly string[] | null;
  revision: number;
  referenceState?: ComponentProps<typeof PpeQueryState>;
  onOpenFilters?: () => void;
  onChanged: () => void;
}) {
  const [search, setSearch] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [applied, setApplied] = useState<IssueFilters>({});
  const [detail, setDetail] = useState<number | null>(null);
  const [page, setPage] = useState(0);
  const [settledSearch, setSettledSearch] = useState('');
  const [sort, setSort] = useState<{ key: string; direction: DataTableSortDirection }>({ key: 'date', direction: 'desc' });
  useEffect(() => {
    const timer = window.setTimeout(() => { setSettledSearch(search); setPage(0); }, 200);
    return () => window.clearTimeout(timer);
  }, [search]);
  const journal = usePpeQuery(
    `journal:${JSON.stringify(applied)}:${revision}:${page}:${settledSearch}:${sort.key}:${sort.direction}`,
    (signal) => ppeApi.journal({ ...applied, page: String(page + 1), limit: '100', search: settledSearch, sort: sort.key, direction: sort.direction }, signal),
  );
  const isLoading = journal.loading || search !== settledSearch;
  const activeFilterCount = Object.values(applied).filter(Boolean).length;
  const rows = journal.data?.items ?? [];
  useEffect(() => {
    if (journal.data && page > 0 && page * 100 >= journal.data.total) setPage(Math.max(0, Math.ceil(journal.data.total / 100) - 1));
  }, [journal.data, page]);
  const columns = useMemo(() => createJournalColumns(setDetail), []);
  return (
    <>
      <div className="ppe-search-toolbar ppe-journal-toolbar">
        <div className="ppe-journal-search search-input-shell">
          <Search size={18} aria-hidden="true" />
          <input
            autoFocus={autoFocusSearch}
            aria-label="Поиск по журналу"
            maxLength={200}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                e.preventDefault();
                setSettledSearch(search);
                setPage(0);
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
                setSettledSearch('');
                setPage(0);
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
              setPage(0);
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
              sort={sort}
              serverSorted
              onSortChange={(nextSort) => { setSort(nextSort); setPage(0); }}
            />
          </div>
        ) : (
          <p className="admin-state">
            {settledSearch.trim()
              ? "По вашему запросу ничего не найдено."
              : "Выдач по выбранным фильтрам нет."}
          </p>
        ))}
      {journal.data && !journal.error ? <PageNavigation page={page} pageSize={100} total={journal.data.total} loading={isLoading} onChange={setPage} /> : null}
      {detail !== null && (
        <IssueDetailsModal
          id={detail}
          permissions={permissions}
          onClose={() => setDetail(null)}
          onChanged={onChanged}
        />
      )}
    </>
  );
}
