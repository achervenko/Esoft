import type { DictionaryManufacturer } from "../../shared/api/dictionaries-admin-api";
import { AdminTableActions } from "../../shared/ui/AdminTableActions";
import { DataTable, type DataTableColumn } from "../../shared/ui/DataTable";

type ManufacturersTableProps = {
  manufacturers: DictionaryManufacturer[];
  onDelete: (manufacturer: DictionaryManufacturer) => void;
  onEdit: (manufacturer: DictionaryManufacturer) => void;
};

const columns = (
  onEdit: (manufacturer: DictionaryManufacturer) => void,
  onDelete: (manufacturer: DictionaryManufacturer) => void,
): Array<DataTableColumn<DictionaryManufacturer, string>> => [
  {
    key: "name",
    label: "Производитель",
    render: (manufacturer) => <strong>{manufacturer.name}</strong>,
    sortValue: (manufacturer) => manufacturer.name,
  },
  {
    key: "actions",
    label: "",
    render: (manufacturer) => (
      <AdminTableActions
        deleteLabel={`Удалить производителя ${manufacturer.name}`}
        editLabel={`Редактировать производителя ${manufacturer.name}`}
        onDelete={() => onDelete(manufacturer)}
        onEdit={() => onEdit(manufacturer)}
      />
    ),
  },
];

export function ManufacturersTable({
  manufacturers,
  onDelete,
  onEdit,
}: ManufacturersTableProps) {
  return (
    <DataTable
      columns={columns(onEdit, onDelete)}
      defaultSort={{ direction: "asc", key: "name" }}
      getRowKey={(manufacturer) => manufacturer.id}
      rows={manufacturers}
    />
  );
}
