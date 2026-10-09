import { Edit2, Power } from "lucide-react";
import type { AdminEmployee } from "../../shared/api/users-admin-api";
import { DataTable, type DataTableColumn } from "../../shared/ui/DataTable";

type DictionaryEmployeesTableProps = {
  employees: AdminEmployee[];
  onEdit: (employee: AdminEmployee) => void;
  onToggleStatus: (employee: AdminEmployee) => void;
  onSizes?: (employee: AdminEmployee) => void;
};

const employeeColumns = (
  onEdit: (employee: AdminEmployee) => void,
  onToggleStatus: (employee: AdminEmployee) => void,
  onSizes?: (employee: AdminEmployee) => void,
): Array<DataTableColumn<AdminEmployee, string>> => [
  {
    key: "fullName",
    label: "Сотрудник",
    render: (employee) => <strong>{employee.fullName}</strong>,
    sortValue: (employee) => employee.fullName,
  },
  {
    key: "position",
    label: "Должность",
    render: (employee) => employee.position,
    sortValue: (employee) => employee.position,
  },
  {
    key: "actions",
    className: "admin-table-actions-column",
    label: "",
    render: (employee) => {
      const isOwnActiveEmployee =
        employee.isActive && employee.isLinkedToCurrentUser;
      const statusTitle = isOwnActiveEmployee
        ? "Нельзя отключить сотрудника, связанного с текущей учётной записью"
        : employee.isActive
          ? "Отключить"
          : "Включить";

      return (
        <div className="admin-table-actions">
          {onSizes && (
            <button type="button" onClick={() => onSizes(employee)}>
              Размеры
            </button>
          )}
          <button
            aria-label={`Редактировать сотрудника ${employee.fullName}`}
            className="admin-icon-button"
            onClick={() => onEdit(employee)}
            title="Редактировать"
            type="button"
          >
            <Edit2 size={17} />
          </button>
          <button
            aria-label={
              employee.isActive
                ? `Отключить сотрудника ${employee.fullName}`
                : `Включить сотрудника ${employee.fullName}`
            }
            className={`admin-icon-button admin-status-toggle${
              employee.isActive ? " active" : " inactive"
            }`}
            disabled={isOwnActiveEmployee}
            onClick={() => onToggleStatus(employee)}
            title={statusTitle}
            type="button"
          >
            <Power size={17} />
          </button>
        </div>
      );
    },
  },
];

export function DictionaryEmployeesTable({
  employees,
  onEdit,
  onToggleStatus,
  onSizes,
}: DictionaryEmployeesTableProps) {
  return (
    <DataTable
      columns={employeeColumns(onEdit, onToggleStatus, onSizes)}
      defaultSort={{ direction: "asc", key: "fullName" }}
      getRowKey={(employee) => employee.id}
      rows={employees}
    />
  );
}
