import type { PpeIssue } from "../../shared/api/ppe";
import type { DataTableColumn } from "../../shared/ui/DataTable";
import {
  formatPpeDate,
  formatPpeQuantity,
  sizeLabel,
} from "../../modules/ppe-ui/ppe-presentation";
export function createJournalColumns(
  onOpenDetails: (id: number) => void,
): DataTableColumn<PpeIssue, string>[] {
  return [
    {
      key: "date",
      label: "Дата выдачи",
      render: (row) => formatPpeDate(row.issuedAt),
      sortValue: (row) => row.issuedAt,
    },
    {
      key: "employee",
      label: "Сотрудник",
      render: (row) => (
        <>
          <strong>{row.employeeName}</strong>
          <small>{row.position}</small>
        </>
      ),
      sortValue: (row) => row.employeeName,
    },
    {
      key: "type",
      label: "Вид",
      render: (row) =>
        row.issueType === "REGULAR" ? "Нормативная" : "Дополнительная",
      sortValue: (row) => row.issueType,
    },
    {
      key: "actual",
      label: "Выдано",
      render: (row) => row.name,
      sortValue: (row) => row.name,
    },
    {
      key: "quantity",
      label: "Количество",
      render: (row) => formatPpeQuantity(row.quantity, row.unit),
      sortValue: (row) => row.quantity,
    },
    {
      key: "size",
      label: "Размер",
      render: (row) => sizeLabel(row.sizeValue, row.clothingHeight),
      sortValue: (row) => sizeLabel(row.sizeValue, row.clothingHeight),
    },
    {
    key: "actions",
    className: "admin-table-actions-column",
      label: "Подробности",
      isSortable: false,
      render: (row) => (
        <div className="admin-table-actions">
          <button
            className="admin-secondary-button"
            onClick={() => onOpenDetails(row.id)}
          >
            Открыть
          </button>
        </div>
      ),
    },
  ];
}
