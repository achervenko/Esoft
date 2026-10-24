import type { PpePosition } from "../../shared/api/ppe";
import type { DataTableColumn } from "../../shared/ui/DataTable";
import { InfoTooltip } from "../../shared/ui/InfoTooltip";
import { normStatusLabels, type NormCoverage } from "./norm-coverage";

const statuses = {
  invalid: {
    label: normStatusLabels.invalid,
    className: "ppe-norm-invalid",
    rank: 1,
  },
  complete: {
    label: normStatusLabels.complete,
    className: "ppe-good",
    rank: 2,
  },
  missing: {
    label: normStatusLabels.missing,
    className: "ppe-norm-missing",
    rank: 0,
  },
  partial: {
    label: normStatusLabels.partial,
    className: "ppe-norm-invalid",
    rank: 1,
  },
};

export function createNormColumns({
  coverage,
  openPosition,
}: {
  coverage: Map<number, NormCoverage>;
  openPosition: (id: number) => void;
}): DataTableColumn<PpePosition, string>[] {
  const forPosition = (id: number) =>
    coverage.get(id) ?? { status: "missing" as const };
  return [
    {
      key: "position",
      label: "Должность",
      render: (row) => (
        <>
          {row.name}
          {!row.isActive && <small>Удалена</small>}
        </>
      ),
      sortValue: (row) => row.name,
    },
    {
      key: "status",
      label: "Статус",
      render: (row) => {
        const summary = forPosition(row.id);
        const { label, className } = statuses[summary.status];
        const showInfo =
          summary.status !== "complete" || Boolean(summary.reasons?.length);
        return (
          <span
            className={`ppe-badge ppe-norm-coverage-badge ${className}${showInfo ? " ppe-norm-coverage-with-info" : ""}`}
          >
            {label}
            {showInfo && (
              <InfoTooltip
                label={`Причины статуса «${label}»: ${row.name}`}
                reasons={
                  summary.reasons?.length
                    ? summary.reasons
                    : ["Нет подходящей действующей нормы"]
                }
              />
            )}
          </span>
        );
      },
      sortValue: (row) => statuses[forPosition(row.id).status].rank,
    },
    {
      key: "actions",
      className: "admin-table-actions-column ppe-norm-open-column",
      label: "",
      isSortable: false,
      render: (row) => (
        <button
          type="button"
          className="admin-secondary-button"
          onClick={() => openPosition(row.id)}
        >
          Открыть
        </button>
      ),
    },
  ];
}
