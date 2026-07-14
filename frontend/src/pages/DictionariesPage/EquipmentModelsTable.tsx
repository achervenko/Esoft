import type { DictionaryEquipmentModel } from "../../shared/api/dictionaries-admin-api";
import { AdminTableActions } from "../../shared/ui/AdminTableActions";
import { DataTable, type DataTableColumn } from "../../shared/ui/DataTable";

type EquipmentModelsTableProps = {
  models: DictionaryEquipmentModel[];
  onDelete: (model: DictionaryEquipmentModel) => void;
  onEdit: (model: DictionaryEquipmentModel) => void;
};

const columns = (
  onEdit: (model: DictionaryEquipmentModel) => void,
  onDelete: (model: DictionaryEquipmentModel) => void,
): Array<DataTableColumn<DictionaryEquipmentModel, string>> => [
  {
    key: "name",
    label: "Модель",
    render: (model) => <strong>{model.name}</strong>,
    sortValue: (model) => model.name,
  },
  {
    key: "manufacturer",
    label: "Производитель",
    render: (model) => model.manufacturer.name,
    sortValue: (model) => model.manufacturer.name,
  },
  {
    key: "actions",
    label: "",
    render: (model) => (
      <AdminTableActions
        deleteLabel={`Удалить модель ${model.name}`}
        editLabel={`Редактировать модель ${model.name}`}
        onDelete={() => onDelete(model)}
        onEdit={() => onEdit(model)}
      />
    ),
  },
];

export function EquipmentModelsTable({
  models,
  onDelete,
  onEdit,
}: EquipmentModelsTableProps) {
  return (
    <DataTable
      columns={columns(onEdit, onDelete)}
      defaultSort={{ direction: "asc", key: "manufacturer" }}
      getRowKey={(model) => model.id}
      rows={models}
    />
  );
}
