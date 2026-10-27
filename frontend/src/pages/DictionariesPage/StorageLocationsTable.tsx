import type { StorageLocation } from "../../shared/api/storage-locations-api";
import { DataTable, type DataTableColumn } from "../../shared/ui/DataTable";
import { Switch } from "../../shared/ui/Switch";

export type StorageLocationsSort = {
  key: "code" | "name" | "isActive";
  direction: "asc" | "desc";
};

export function StorageLocationsTable({
  rows,
  canManage,
  saving,
  sort,
  onSortChange,
  onEdit,
  onToggle,
}: {
  rows: StorageLocation[];
  canManage: boolean;
  saving: boolean;
  sort: StorageLocationsSort;
  onSortChange: (sort: StorageLocationsSort) => void;
  onEdit: (item: StorageLocation) => void;
  onToggle: (item: StorageLocation) => Promise<void>;
}) {
  const columns: DataTableColumn<StorageLocation, string>[] = [
    {
      key: "warehouse",
      label: "Склад",
      render: (r) => `${r.warehouse.name} (${r.warehouse.code})`,
    },
    { key: "code", label: "Код", render: (r) => r.code },
    { key: "name", label: "Наименование", render: (r) => r.name },
    {
      key: "isActive",
      label: "Статус",
      render: (r) =>
        canManage ? (
          <Switch
            checked={r.isActive}
            disabled={saving}
            label={`Активность места ${r.code}`}
            title={r.isActive ? "Деактивировать" : "Активировать"}
            onChange={() => void onToggle(r)}
          />
        ) : r.isActive ? (
          "Активно"
        ) : (
          "Неактивно"
        ),
    },
  ];

  return (
    <div className="dictionary-table-surface storage-locations-table">
      <DataTable
        rows={rows}
        onRowClick={canManage && !saving ? onEdit : undefined}
        columns={columns}
        getRowKey={(r) => r.id}
        defaultSort={{ key: "code", direction: "asc" }}
        sort={sort}
        serverSorted
        onSortChange={(s) => {
          if (s.key === "code" || s.key === "name" || s.key === "isActive") {
            onSortChange({ ...s, key: s.key });
          }
        }}
      />
    </div>
  );
}
