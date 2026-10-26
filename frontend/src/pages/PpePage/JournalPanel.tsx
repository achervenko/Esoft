import { SearchToolbar } from "../../shared/ui/SearchToolbar";
import { LoadingIndicator } from "../../shared/ui/LoadingIndicator";
import { AdminModal } from "../../shared/ui/AdminModal";
import { JournalFiltersModal } from "./JournalFiltersModal";
import { createJournalColumns } from "./journal-columns";
import { useEffect, useMemo, useState, type ComponentProps } from "react";
import {
  ppeApi,
  type IssueFilters,
  type PpeEmployee,
  type PpeItem,
  type PpePosition,
} from "../../shared/api/ppe";
import {
  DataTable,
  type DataTableSortDirection,
} from "../../shared/ui/DataTable";
import { ListLoadMore } from "../../shared/ui/ListLoadMore";
import { useIncrementalList } from "../../shared/lib/useIncrementalList";
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
  const [settledSearch, setSettledSearch] = useState("");
  const [sort, setSort] = useState<{
    key: string;
    direction: DataTableSortDirection;
  }>({ key: "date", direction: "desc" });
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSettledSearch(search);
    }, 200);
    return () => window.clearTimeout(timer);
  }, [search]);
  const journal = useIncrementalList({
    queryKey: JSON.stringify([applied, revision, settledSearch, sort]),
    enabled: search === settledSearch,
    getKey: (
      issue: Awaited<ReturnType<typeof ppeApi.journal>>["items"][number],
    ) => issue.id,
    loadPage: (offset, signal) =>
      ppeApi.journal(
        {
          ...applied,
          page: String(Math.floor(offset / 100) + 1),
          limit: "100",
          search: settledSearch,
          sort: sort.key,
          direction: sort.direction,
        },
        signal,
      ),
  });
  const isLoading =
    (journal.loading && !journal.data) || search !== settledSearch;
  const activeFilterCount = Object.values(applied).filter(Boolean).length;
  const rows = journal.data?.items ?? [];
  const columns = useMemo(() => createJournalColumns(setDetail), []);
  return (
    <>
      <SearchToolbar
        label="Поиск по журналу"
        value={search}
        onChange={setSearch}
        clearLabel="Очистить поиск"
        onClear={() => {
          setSearch("");
          setSettledSearch("");
        }}
        inputProps={{
          autoFocus: autoFocusSearch,
          maxLength: 200,
          onKeyDown: (event) => {
            if (event.key === "Enter" && !event.nativeEvent.isComposing) {
              event.preventDefault();
              setSettledSearch(search);
            }
          },
        }}
        filters={{
          label: "Фильтры",
          title: "Фильтры",
          count: activeFilterCount,
          expanded: filtersOpen,
          controls: "ppe-journal-filters",
          onOpen: () => {
            onOpenFilters?.();
            setFiltersOpen(true);
          },
        }}
      />
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
              setFiltersOpen(false);
            }}
          />
        ))}
      <LoadingIndicator loading={isLoading} />
      <PpeQueryState
        loading={false}
        error={!journal.data ? journal.error : null}
        reload={() => {
          journal.retry();
        }}
      />
      {!isLoading &&
        journal.data &&
        (rows.length ? (
          <div className="admin-card ppe-table-wrap">
            <DataTable
              key={JSON.stringify([applied, revision, settledSearch, sort])}
              windowed
              columns={columns}
              rows={rows}
              defaultSort={{ key: "date", direction: "desc" }}
              getRowKey={(row) => row.id}
              onRowClick={(row) => setDetail(row.id)}
              sort={sort}
              serverSorted
              onSortChange={(nextSort) => {
                setSort(nextSort);
              }}
            />
          </div>
        ) : (
          <p className="admin-state">
            {settledSearch.trim()
              ? "По вашему запросу ничего не найдено."
              : "Выдач по выбранным фильтрам нет."}
          </p>
        ))}
      <ListLoadMore list={journal} disabled={detail !== null || filtersOpen} />
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
