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
import { useEffect, useState } from "react";
import {
  ppeApi,
  type PpeItem,
  type PpeNorm,
  type PpePosition,
} from "../../shared/api/ppe";
import { canManagePpeNorms } from "../../modules/ppe-permissions/ppe-permissions";
import { DataTable } from "../../shared/ui/DataTable";
import { Search, X } from "lucide-react";
import { usePpeQuery } from "../../modules/ppe-ui/usePpeQuery";
import { PpeQueryState } from "../../modules/ppe-ui/PpeQueryState";
import { NormFormModal } from "./NormFormModal";
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
  const [search, setSearch] = useState("");
  const [form, setForm] = useState<NormFormState | null>(null);
  const [lifecycle, setLifecycle] = useState<PpeNorm | null>(null);
  useEffect(() => {
    setPosition(initialPositionId ? String(initialPositionId) : "");
    setForm(null);
    setLifecycle(null);
  }, [initialPositionId]);
  const norms = usePpeQuery(`norms:${revision}`, (signal) =>
    ppeApi.norms(undefined, signal),
  );
  const manage = canManagePpeNorms(permissions);
  const selected = positions.find((item) => String(item.id) === position);
  const visiblePositions = searchNormPositions(positions, search);
  const selectedNorms = norms.data?.filter(
    (norm) => String(norm.positionId) === position,
  );
  const columns = createNormColumns({
    norms: norms.data,
    manage,
    opensRoute: Boolean(onOpenPosition),
    openPosition,
    onCreate: () => setForm({ mode: "create", norm: null }),
  });
  return (
    <>
      {!position && (
        <div className="admin-card ppe-search-toolbar ppe-norm-search-toolbar">
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
          </div>
        </div>
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
        loading={Boolean(referenceState?.loading || norms.loading)}
        error={referenceState?.error ?? norms.error}
        reload={() => {
          referenceState?.reload();
          norms.reload();
        }}
      />
      {!position &&
        !referenceState?.loading &&
        !norms.loading &&
        !referenceState?.error &&
        norms.data &&
        (visiblePositions.length ? (
          <div className="admin-card ppe-table-wrap ppe-list-table-card">
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
        selectedNorms?.length === 0 && (
          <p className="admin-state ppe-norms-empty">
            Для этой должности нормы пока не созданы.
          </p>
        )}
      {position &&
        !norms.loading &&
        !referenceState?.loading &&
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
      {form && selected && (
        <NormFormModal
          state={form}
          position={selected}
          items={items}
          onClose={() => setForm(null)}
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
