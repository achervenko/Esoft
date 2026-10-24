import { AdminTableActions } from "../../shared/ui/AdminTableActions";
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
      key: "actions",
      className: "admin-table-actions-column",
      label: "",
      render: (item) => (
        <AdminTableActions
          disabled={isSaving}
          editLabel={`Редактировать должность ${item.name}`}
          deleteLabel={`Удалить должность ${item.name}`}
          onEdit={() => onEdit(item)}
          onDelete={() => onToggleStatus(item)}
        />
      ),
    },
  ];
  return (
    <DataTable
      columns={columns}
      defaultSort={{ direction: "asc", key: "name" }}
      getRowKey={(item) => item.id}
      rows={positions.filter((position) => position.isActive)}
    />
  );
}
