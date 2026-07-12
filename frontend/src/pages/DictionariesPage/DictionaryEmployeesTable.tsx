import type { AdminEmployee } from "../../shared/api/users-admin-api";
import { AdminTableActions } from "../../shared/ui/AdminTableActions";
import { DataTable, type DataTableColumn } from "../../shared/ui/DataTable";

type DictionaryEmployeesTableProps = {
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
      <AdminTableActions
        deleteLabel={`Удалить сотрудника ${employee.fullName}`}
        editLabel={`Редактировать сотрудника ${employee.fullName}`}
        onDelete={() => onDelete(employee)}
        onEdit={() => onEdit(employee)}
      />
    ),
  },
];

export function DictionaryEmployeesTable({
  employees,
  onDelete,
  onEdit,
}: DictionaryEmployeesTableProps) {
  return (
    <DataTable
      columns={employeeColumns(onEdit, onDelete)}
      defaultSort={{ direction: "asc", key: "fullName" }}
      getRowKey={(employee) => employee.id}
      rows={employees}
    />
  );
}
