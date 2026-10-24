import type { ComponentProps } from "react";
import { NormCard } from "./NormCard";
import { NormPositionHeader } from "./NormPositionHeader";
import { createNormColumns } from "./norm-columns";
import { searchNormPositions } from "./norm-search";
import {
  normPeriodStatus,
  getNeighborNorms,
  type NormFormState,
} from "./norm-model";
export type { NormFormState } from "./norm-model";
import "../../shared/ui/SearchInput.css";
import { useEffect, useMemo, useState } from "react";
import {
  ppeApi,
  type PpeItem,
  type PpeNorm,
  type PpePosition,
} from "../../shared/api/ppe";
import { canManagePpeNorms } from "../../modules/ppe-permissions/ppe-permissions";
import { DataTable } from "../../shared/ui/DataTable";
import { Plus, Search, SlidersHorizontal, X } from "lucide-react";
import { usePpeQuery } from "../../modules/ppe-ui/usePpeQuery";
import { PpeQueryState } from "../../modules/ppe-ui/PpeQueryState";
import { NormFormModal } from "./NormFormModal";
import { getNormCoverage } from "./norm-coverage";
import { NormCreatePositionModal } from "./NormCreatePositionModal";
import { NormFiltersModal, type NormStatusFilter } from "./NormFiltersModal";
import { NormLifecycleDialog } from "./NormLifecycleDialog";
export function NormsPanel({
  autoFocusSearch = true,
  positions,
  items,
  permissions,
  revision,
  referenceState,
  onChanged,
  initialPositionId,
  onOpenPosition,
  onBack,
}: {
  autoFocusSearch?: boolean;
  positions: PpePosition[];
  items: PpeItem[];
  referenceState?: ComponentProps<typeof PpeQueryState>;
  permissions: readonly string[] | null;
  revision: number;
  onChanged: () => void;
  initialPositionId?: number;
  onOpenPosition?: (id: number) => void;
  onBack?: () => void;
}) {
  const [position, setPosition] = useState(
    initialPositionId ? String(initialPositionId) : "",
  );
  const openPosition = (id: number) =>
    onOpenPosition ? onOpenPosition(id) : setPosition(String(id));
  const [choosingPosition, setChoosingPosition] = useState(false);
  const [createPosition, setCreatePosition] = useState<PpePosition | null>(null);
  const [statusFilter, setStatusFilter] = useState<NormStatusFilter>([]);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState<NormFormState | null>(null);
  const [lifecycle, setLifecycle] = useState<PpeNorm | null>(null);
  useEffect(() => {
    setPosition(initialPositionId ? String(initialPositionId) : "");
    setForm(null);
    setLifecycle(null);
    setChoosingPosition(false);
    setCreatePosition(null);
    setFiltersOpen(false);
  }, [initialPositionId]);
  const norms = usePpeQuery(`norms:${revision}`, (signal) =>
    ppeApi.norms(undefined, signal),
  );
  const employees = usePpeQuery(
    `norm-employees:${revision}:${permissions}`,
    (signal) => ppeApi.employees(signal),
    !position,
  );
  const coverage = useMemo(
    () => getNormCoverage(positions, norms.data ?? [], employees.data ?? []),
    [positions, norms.data, employees.data],
  );
  const listLoading = !position && employees.loading;
  const listError = !position ? employees.error : null;
  const manage = canManagePpeNorms(permissions);
  const selected = positions.find((item) => String(item.id) === position);
  const formPosition = selected ?? createPosition;
  const visiblePositions = searchNormPositions(positions, search).filter(
    (row) => !statusFilter.length || statusFilter.includes(coverage.get(row.id)?.status ?? "missing"),
  );
  const selectedNorms = norms.data?.filter(
    (norm) => String(norm.positionId) === position,
  );
  const columns = createNormColumns({
    coverage,
    openPosition,
  });
  return (
    <>
      {!position && (
        <div className="ppe-search-toolbar ppe-norm-search-toolbar">
          <div className="ppe-journal-search search-input-shell">
            <Search size={18} aria-hidden="true" />
            <input
              autoFocus={autoFocusSearch}
              aria-label="Поиск по должностям"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button
                type="button"
                className="ppe-journal-icon-button"
                aria-label="Очистить поиск"
                onClick={() => setSearch("")}
              >
                <X size={18} aria-hidden="true" />
              </button>
            )}
            <button
              type="button"
              className={`ppe-journal-icon-button${statusFilter.length ? " ppe-journal-filter-active" : ""}`}
              aria-label="Фильтры"
              title="Фильтры норм"
              aria-haspopup="dialog"
              aria-expanded={filtersOpen}
              onClick={() => setFiltersOpen(true)}
            >
              <SlidersHorizontal size={20} aria-hidden="true" />
            </button>
          </div>
          {manage && (
          <button
            type="button"
            aria-label="Добавить норму"
            className="admin-primary-button"
            disabled={Boolean(
              referenceState?.loading || norms.loading ||
              referenceState?.error || norms.error ||
              !positions.some((row) => row.isActive)
            )}
            onClick={() => setChoosingPosition(true)}
          >
            <Plus size={18} aria-hidden="true" />
            Добавить
          </button>
          )}
        </div>
      )}
      {filtersOpen && (
        <NormFiltersModal
          statuses={statusFilter}
          onClose={() => setFiltersOpen(false)}
          onApply={(status) => {
            setStatusFilter(status);
            setFiltersOpen(false);
          }}
        />
      )}
      {position && (
        <NormPositionHeader
          selected={selected}
          manage={manage}
          loading={norms.loading}
          selectedNorms={selectedNorms}
          onBack={() => (onBack ? onBack() : setPosition(""))}
          onCreate={() => setForm({ mode: "create", norm: null })}
        />
      )}
      <PpeQueryState
        page
        loading={Boolean(referenceState?.loading || norms.loading || listLoading)}
        error={referenceState?.error ?? norms.error ?? listError}
        reload={() => {
          referenceState?.reload();
          norms.reload();
          if (!position) employees.reload();
        }}
      />
      {!position &&
        !referenceState?.loading &&
        !norms.loading &&
        !listLoading &&
        !listError &&
        !norms.error &&
        !referenceState?.error &&
        norms.data &&
        (visiblePositions.length ? (
          <div className="admin-card ppe-table-wrap ppe-list-table-card ppe-norms-list-card">
            <DataTable
              columns={columns}
              rows={visiblePositions}
              getRowKey={(row) => row.id}
              defaultSort={{ key: "position", direction: "asc" }}
              onRowClick={(row) => openPosition(row.id)}
            />
          </div>
        ) : (
          <p className="admin-state">
            {positions.length
              ? "Ничего не найдено."
              : "Должности пока не заведены."}
          </p>
        ))}
      {position &&
        !norms.loading &&
        !referenceState?.loading &&
        !norms.error &&
        !referenceState?.error &&
        selectedNorms?.length === 0 && (
          <p className="admin-state ppe-norms-empty">
            Для этой должности нормы пока не созданы.
          </p>
        )}
      {position &&
        !norms.loading &&
        !referenceState?.loading &&
        !norms.error &&
        !referenceState?.error &&
        selectedNorms?.map((norm) => (
          <NormCard
            key={norm.id}
            norm={norm}
            selectedNorms={selectedNorms}
            manage={manage}
            positionActive={Boolean(selected?.isActive)}
            onForm={setForm}
            onLifecycle={setLifecycle}
          />
        ))}
      {choosingPosition && (
        <NormCreatePositionModal
          positions={positions}
          onClose={() => setChoosingPosition(false)}
          onSelect={(selectedPosition) => {
            setCreatePosition(selectedPosition);
            setChoosingPosition(false);
            setForm({ mode: "create", norm: null });
          }}
        />
      )}
      {form && formPosition && (
        <NormFormModal
          state={form}
          position={formPosition}
          items={items}
          onClose={() => {
            setForm(null);
            setCreatePosition(null);
          }}
          onChanged={onChanged}
        />
      )}
      {lifecycle && (
        <NormLifecycleDialog
          norm={lifecycle}
          deleting={normPeriodStatus(lifecycle) === "Будущая"}
          {...getNeighborNorms(selectedNorms ?? [], lifecycle)}
          onClose={() => setLifecycle(null)}
          onChanged={onChanged}
        />
      )}
    </>
  );
}
