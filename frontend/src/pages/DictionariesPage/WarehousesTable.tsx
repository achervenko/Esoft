import { AdminTableActions } from "../../shared/ui/AdminTableActions";
import type { Warehouse } from "../../shared/api/warehouses-api";
import { DataTable, type DataTableColumn } from "../../shared/ui/DataTable";
export function WarehousesTable({
  rows,
  selectedId,
  canManage,
  saving,
  onSelect,
  onEdit,
  onDelete,
}: {
  rows: Warehouse[];
  selectedId: string | null;
  canManage: boolean;
  saving: boolean;
  onSelect: (row: Warehouse) => void;
  onEdit: (row: Warehouse) => void;
  onDelete: (row: Warehouse) => Promise<void>;
}) {
  const columns: DataTableColumn<Warehouse, string>[] = [
    {
      key: "name",
      label: "Склад",
      render: (row) => <strong>{row.name}</strong>,
      sortValue: (row) => row.name,
    },
    ...(canManage
      ? [
          {
            key: "actions",
            label: "",
            className: "admin-table-actions-column",
            isSortable: false,
            render: (row: Warehouse) => (
              <AdminTableActions
                disabled={saving}
                editLabel={`Редактировать склад ${row.name}`}
                deleteLabel={`Удалить склад ${row.name}`}
                onEdit={() => onEdit(row)}
                onDelete={() => void onDelete(row)}
              />
            ),
          },
        ]
      : []),
  ];
  return (
    <DataTable
      rows={rows}
      columns={columns}
      getRowKey={(row) => row.id}
      selectedRowKey={selectedId}
      onRowClick={saving ? undefined : onSelect}
      defaultSort={{ key: "name", direction: "asc" }}
    />
  );
}
