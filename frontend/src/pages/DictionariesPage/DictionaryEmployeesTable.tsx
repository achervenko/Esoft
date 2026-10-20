import { Edit2 } from "lucide-react";
import type { AdminEmployee } from "../../shared/api/users-admin-api";
import { DataTable, type DataTableColumn } from "../../shared/ui/DataTable";
import { Switch } from "../../shared/ui/Switch";
import type { EmployeeSizes } from "../../shared/api/ppe";
import { employeeSizesStatus } from "../../modules/ppe-ui/employee-sizes-model";

type DictionaryEmployeesTableProps = {
  employees: AdminEmployee[];
  isSaving?: boolean;
  onEdit: (employee: AdminEmployee) => void;
  onToggleStatus: (employee: AdminEmployee) => void;
  onSizes?: (employee: AdminEmployee) => void;
  employeeSizes?: ReadonlyMap<number, EmployeeSizes | null>;
};

const employeeColumns = (
  onEdit: (employee: AdminEmployee) => void,
  onToggleStatus: (employee: AdminEmployee) => void,
  isSaving: boolean,
  onSizes?: (employee: AdminEmployee) => void,
  employeeSizes?: ReadonlyMap<number, EmployeeSizes | null>,
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
    key: "status",
    label: "Статус",
    sortValue: (employee) => Number(employee.isActive),
    render: (employee) => (
      <Switch
        label={`Активность сотрудника ${employee.fullName}`}
        checked={employee.isActive}
        disabled={
          isSaving || (employee.isActive && employee.isLinkedToCurrentUser)
        }
        onChange={() => onToggleStatus(employee)}
        title={
          employee.isActive && employee.isLinkedToCurrentUser
            ? "Нельзя отключить сотрудника, связанного с текущей учётной записью"
            : employee.isActive
              ? "Отключить сотрудника"
              : "Включить сотрудника"
        }
      />
    ),
  },
  {
    key: "actions",
    className: "admin-table-actions-column",
    label: "",
    render: (employee) => {
      const status = employeeSizes?.has(employee.id)
        ? employeeSizesStatus(employeeSizes.get(employee.id) ?? null)
        : "complete";
      const warning =
        status === "missing"
          ? "Размеры не заполнены"
          : "Размеры заполнены частично";
      return (
        <div className="admin-table-actions">
          {onSizes && (
            <button
              className="employee-sizes-button"
              type="button"
              disabled={isSaving}
              onClick={() => onSizes(employee)}
            >
              Размеры
              {status !== "complete" && (
                <span
                  className={`employee-sizes-dot ${status}`}
                  role="img"
                  aria-label={warning}
                  title={warning}
                />
              )}
            </button>
          )}
          <button
            aria-label={`Редактировать сотрудника ${employee.fullName}`}
            className="admin-icon-button"
            disabled={isSaving}
            onClick={() => onEdit(employee)}
            title="Редактировать"
            type="button"
          >
            <Edit2 size={17} />
          </button>
        </div>
      );
    },
  },
];

export function DictionaryEmployeesTable({
  employees,
  isSaving = false,
  onEdit,
  onToggleStatus,
  onSizes,
  employeeSizes,
}: DictionaryEmployeesTableProps) {
  return (
    <DataTable
      columns={employeeColumns(
        onEdit,
        onToggleStatus,
        isSaving,
        onSizes,
        employeeSizes,
      )}
      defaultSort={{ direction: "asc", key: "fullName" }}
      getRowKey={(employee) => employee.id}
      rows={employees}
      getRowGroup={(employee) => (employee.isActive ? 0 : 1)}
      animateRowMoves
    />
  );
}
