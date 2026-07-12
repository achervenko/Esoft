import type { DictionaryObject } from "../../shared/api/dictionaries-admin-api";
import { AdminTableActions } from "../../shared/ui/AdminTableActions";
import { DataTable, type DataTableColumn } from "../../shared/ui/DataTable";

type ObjectsTableProps = {
  objects: DictionaryObject[];
  onDelete: (object: DictionaryObject) => void;
  onEdit: (object: DictionaryObject) => void;
};

const columns = (
  onEdit: (object: DictionaryObject) => void,
  onDelete: (object: DictionaryObject) => void,
): Array<DataTableColumn<DictionaryObject, string>> => [
  {
    key: "name",
    label: "Объект",
    render: (object) => <strong>{object.name}</strong>,
    sortValue: (object) => object.name,
  },
  {
    key: "actions",
    label: "",
    render: (object) => (
      <AdminTableActions
        deleteLabel={`Удалить объект ${object.name}`}
        editLabel={`Редактировать объект ${object.name}`}
        onDelete={() => onDelete(object)}
        onEdit={() => onEdit(object)}
      />
    ),
  },
];

export function ObjectsTable({ objects, onDelete, onEdit }: ObjectsTableProps) {
  return (
    <DataTable
      columns={columns(onEdit, onDelete)}
      defaultSort={{ direction: "asc", key: "name" }}
      getRowKey={(object) => object.id}
      rows={objects}
    />
  );
}
