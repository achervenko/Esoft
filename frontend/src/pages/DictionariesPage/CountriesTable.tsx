import type { DictionaryCountry } from "../../shared/api/dictionaries-admin-api";
import { AdminTableActions } from "../../shared/ui/AdminTableActions";
import { DataTable, type DataTableColumn } from "../../shared/ui/DataTable";

type CountriesTableProps = {
  countries: DictionaryCountry[];
  onDelete: (country: DictionaryCountry) => void;
  onEdit: (country: DictionaryCountry) => void;
};

const columns = (
  onEdit: (country: DictionaryCountry) => void,
  onDelete: (country: DictionaryCountry) => void,
): Array<DataTableColumn<DictionaryCountry, string>> => [
  {
    key: "name",
    label: "Страна",
    render: (country) => <strong>{country.name}</strong>,
    sortValue: (country) => country.name,
  },
  {
    key: "iso",
    label: "ISO",
    render: (country) => country.iso,
    sortValue: (country) => country.iso,
  },
  {
    key: "actions",
    label: "",
    render: (country) => (
      <AdminTableActions
        deleteLabel={`Удалить страну ${country.name}`}
        editLabel={`Редактировать страну ${country.name}`}
        onDelete={() => onDelete(country)}
        onEdit={() => onEdit(country)}
      />
    ),
  },
];

export function CountriesTable({
  countries,
  onDelete,
  onEdit,
}: CountriesTableProps) {
  return (
    <DataTable
      columns={columns(onEdit, onDelete)}
      defaultSort={{ direction: "asc", key: "name" }}
      getRowKey={(country) => country.id}
      rows={countries}
    />
  );
}
