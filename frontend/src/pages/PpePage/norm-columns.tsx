import type { PpePosition, PpeNorm } from "../../shared/api/ppe";
import type { DataTableColumn } from "../../shared/ui/DataTable";
import { normPeriodStatus } from "./norm-model";
type NormColumnsOptions = {
  norms: PpeNorm[] | null;
  manage: boolean;
  opensRoute: boolean;
  openPosition: (id: number) => void;
  onCreate: () => void;
};
export function createNormColumns({
  norms,
  manage,
  opensRoute,
  openPosition,
  onCreate,
}: NormColumnsOptions): DataTableColumn<PpePosition, string>[] {
  return [
    {
      key: "position",
      label: "Должность",
      render: (row) => (
        <>
          {row.name}
          {!row.isActive && <small>Отключена</small>}
        </>
      ),
      sortValue: (row) => row.name,
    },
    {
      key: "norms",
      label: "Норма",
      render: (row) => {
        const revisions =
          norms?.filter((norm) => norm.positionId === row.id) ?? [];
        const effective = revisions.some(
          (norm) => normPeriodStatus(norm) === "Действующая",
        );
        return (
          <>
            <span
              className={
                "ppe-badge " +
                (effective
                  ? "ppe-good"
                  : revisions.length
                    ? "ppe-norm-invalid"
                    : "ppe-norm-missing")
              }
            >
              {effective
                ? "Действующая"
                : revisions.length
                  ? "Недействительна"
                  : "Отсутствует"}
            </span>
          </>
        );
      },
      sortValue: (row) =>
        Number(norms?.some((norm) => norm.positionId === row.id)),
    },
    {
    key: "actions",
    className: "admin-table-actions-column",
      label: "",
      isSortable: false,
      render: (row) => {
        const hasNorms = norms?.some((norm) => norm.positionId === row.id);
        return (
          <button
            className="admin-secondary-button"
            onClick={() => {
              openPosition(row.id);
              if (!opensRoute && !hasNorms && manage && row.isActive)
                onCreate();
            }}
          >
            {!opensRoute && !hasNorms && manage && row.isActive
              ? "Создать норму"
              : "Открыть"}
          </button>
        );
      },
    },
  ];
}
