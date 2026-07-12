import { Edit2, Trash2 } from "lucide-react";
import { DataTable, type DataTableColumn } from "../../shared/ui/DataTable";
import type { AdminEmployee } from "../../shared/api/users-admin-api";

type EmployeesTableProps = {
  employees: AdminEmployee[];
  onDelete: (employee: AdminEmployee) => void;
  onEdit: (employee: AdminEmployee) => void;
};

const employeeColumns = (
  onEdit: (employee: AdminEmployee) => void,
  onDelete: (employee: AdminEmployee) => void,
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
    label: "",
    render: (employee) => (
      <div className="users-table-actions">
        <button
          aria-label={`Редактировать сотрудника ${employee.fullName}`}
          className="users-icon-button"
          onClick={() => onEdit(employee)}
          title="Редактировать"
          type="button"
        >
          <Edit2 size={17} />
        </button>
        <button
          aria-label={`Удалить сотрудника ${employee.fullName}`}
          className="users-icon-button"
          onClick={() => onDelete(employee)}
          title="Удалить"
          type="button"
        >
          <Trash2 size={17} />
        </button>
      </div>
    ),
  },
];

export function EmployeesTable({
  employees,
  onDelete,
  onEdit,
}: EmployeesTableProps) {
  return (
    <DataTable
      columns={employeeColumns(onEdit, onDelete)}
      defaultSort={{ direction: "asc", key: "fullName" }}
      getRowKey={(employee) => employee.id}
      rows={employees}
    />
  );
}
