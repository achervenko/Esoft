import type { PpePosition, PpeNorm } from "../../shared/api/ppe";
import type { DataTableColumn } from "../../shared/ui/DataTable";
import { normPeriodStatus } from "./norm-model";
const genders = [ ["MALE", "Мужской"], ["FEMALE", "Женский"] ] as const;

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
  const statusFor = (positionId: number, gender: "MALE" | "FEMALE") => {
    const revisions = norms?.filter((norm) => norm.positionId === positionId && norm.gender === gender) ?? [];
    if (revisions.some((norm) => normPeriodStatus(norm) === "Действующая"))
      return { label: "Действующая", className: "ppe-good", rank: 2 };
    return revisions.length
      ? { label: "Недействительна", className: "ppe-norm-invalid", rank: 1 }
      : { label: "Отсутствует", className: "ppe-norm-missing", rank: 0 };
  };
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
      key: "gender",
      label: "Пол",
      render: () => <div className="ppe-norm-gender-statuses">{genders.map(([gender, label]) => <span key={gender}>{label}</span>)}</div>,
      isSortable: false,
    },
    {
      key: "norms",
      label: "Норма",
      render: (row) => <div className="ppe-norm-gender-statuses">{genders.map(([gender, label]) => {
        const status = statusFor(row.id, gender);
        return <div role="group" aria-label={`${label}: ${status.label}`} key={gender}>
          <span className={`ppe-badge ${status.className}`}>{status.label}</span>
        </div>;
      })}</div>,
      sortValue: (row) => statusFor(row.id, "MALE").rank * 3 + statusFor(row.id, "FEMALE").rank,
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
