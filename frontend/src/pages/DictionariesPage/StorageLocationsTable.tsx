import { AdminTableActions } from "../../shared/ui/AdminTableActions";
import type { StorageLocation } from "../../shared/api/storage-locations-api";
import { DataTable, type DataTableColumn } from "../../shared/ui/DataTable";

export type StorageLocationsSort = {
  key: "name" | "isActive";
  direction: "asc" | "desc";
};

export function StorageLocationsTable({
  rows,
  canManage,
  saving,
  sort,
  onSortChange,
  onEdit,
  onDelete,
}: {
  rows: StorageLocation[];
  canManage: boolean;
  saving: boolean;
  sort: StorageLocationsSort;
  onSortChange: (sort: StorageLocationsSort) => void;
  onEdit: (item: StorageLocation) => void;
  onDelete: (item: StorageLocation) => Promise<void>;
}) {
  const columns: DataTableColumn<StorageLocation, string>[] = [
    {
      key: "name",
      label: "Место хранения",
      render: (r) => <strong>{r.name}</strong>,
      sortValue: (r) => r.name,
    },
    {
      key: "warehouse",
      label: "Склад",
      isSortable: false,
      render: (r) => r.warehouse.name,
    },
    ...(canManage
      ? [
          {
            key: "actions",
            label: "",
            className: "admin-table-actions-column",
            isSortable: false,
            render: (r: StorageLocation) => (
              <AdminTableActions
                disabled={saving}
                editLabel={`Редактировать место ${r.name}`}
                deleteLabel={`Удалить место ${r.name}`}
                onEdit={() => onEdit(r)}
                onDelete={() => void onDelete(r)}
              />
            ),
          },
        ]
      : []),
  ];

  return (
    <div className="storage-locations-table">
      <DataTable
        rows={rows}
        onRowClick={canManage && !saving ? onEdit : undefined}
        columns={columns}
        getRowKey={(r) => r.id}
        defaultSort={{ key: "name", direction: "asc" }}
        sort={sort}
        serverSorted
        onSortChange={(s) => {
          if (s.key === "name" || s.key === "isActive") {
            onSortChange({ ...s, key: s.key });
          }
        }}
      />
    </div>
  );
}
