import type { AdminPosition } from "../../shared/api/users-admin-api";
import { DataTable, type DataTableColumn } from "../../shared/ui/DataTable";

type Props = {
  positions: AdminPosition[];
  isSaving: boolean;
  onEdit: (position: AdminPosition) => void;
  onToggleStatus: (position: AdminPosition) => void;
};

export function PositionsDictionaryPanel({
  positions,
  isSaving,
  onEdit,
  onToggleStatus,
}: Props) {
  const columns: Array<DataTableColumn<AdminPosition, string>> = [
    {
      key: "name",
      label: "Должность",
      render: (item) => item.name,
      sortValue: (item) => item.name,
    },
    {
      key: "status",
      label: "Статус",
      render: (item) => (item.isActive ? "Активна" : "Отключена"),
      sortValue: (item) => (item.isActive ? 1 : 0),
    },
    {
    key: "actions",
    className: "admin-table-actions-column",
      label: "",
      render: (item) => (
        <div className="admin-form-actions">
          <button
            className="admin-secondary-button"
            disabled={isSaving}
            onClick={() => onEdit(item)}
            type="button"
          >
            Редактировать
          </button>
          <button
            className="admin-secondary-button"
            disabled={isSaving}
            onClick={() => onToggleStatus(item)}
            type="button"
          >
            {item.isActive ? "Отключить" : "Включить"}
          </button>
        </div>
      ),
    },
  ];
  return (
    <DataTable
      columns={columns}
      defaultSort={{ direction: "asc", key: "name" }}
      getRowKey={(item) => item.id}
      rows={positions}
    />
  );
}
