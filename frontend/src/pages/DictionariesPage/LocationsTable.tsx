import type { DictionaryLocation } from "../../shared/api/dictionaries-admin-api";
import { AdminTableActions } from "../../shared/ui/AdminTableActions";
import { DataTable, type DataTableColumn } from "../../shared/ui/DataTable";

type LocationsTableProps = {
  locations: DictionaryLocation[];
  onDelete: (location: DictionaryLocation) => void;
  onEdit: (location: DictionaryLocation) => void;
};

const columns = (
  onEdit: (location: DictionaryLocation) => void,
  onDelete: (location: DictionaryLocation) => void,
): Array<DataTableColumn<DictionaryLocation, string>> => [
  {
    key: "name",
    label: "Местонахождение",
    render: (location) => <strong>{location.name}</strong>,
    sortValue: (location) => location.name,
  },
  {
    key: "object",
    label: "Объект",
    render: (location) => location.workshop.name,
    sortValue: (location) => location.workshop.name,
  },
  {
    key: "actions",
    label: "",
    render: (location) => (
      <AdminTableActions
        deleteLabel={`Удалить местонахождение ${location.name}`}
        editLabel={`Редактировать местонахождение ${location.name}`}
        onDelete={() => onDelete(location)}
        onEdit={() => onEdit(location)}
      />
    ),
  },
];

export function LocationsTable({
  locations,
  onDelete,
  onEdit,
}: LocationsTableProps) {
  return (
    <DataTable
      columns={columns(onEdit, onDelete)}
      defaultSort={{ direction: "asc", key: "object" }}
      getRowKey={(location) => location.id}
      rows={locations}
    />
  );
}
