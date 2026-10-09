import type { PpeItem } from "../../shared/api/ppe";
import type { DataTableColumn } from "../../shared/ui/DataTable";
import { typeLabels } from "../../modules/ppe-ui/ppe-presentation";

export function createCatalogColumns(
  onOpenSizes: (id: number) => void,
): DataTableColumn<PpeItem, string>[] {
  return [
    {
      key: "article",
      label: "Артикул",
      render: (item) => <strong>{item.article}</strong>,
      sortValue: (item) => item.article,
    },
    {
      key: "name",
      label: "Наименование",
      render: (item) => item.name,
      sortValue: (item) => item.name,
    },
    {
      key: "type",
      label: "Тип СИЗ",
      render: (item) => typeLabels[item.type],
      sortValue: (item) => typeLabels[item.type],
    },
    {
      key: "status",
      label: "Статус",
      render: (item) => (
        <span
          className={`ppe-badge ${item.isActive ? "ppe-good" : "ppe-muted"}`}
        >
          {item.isActive ? "Активен" : "Удалён"}
        </span>
      ),
      sortValue: (item) => Number(item.isActive),
    },
    {
      key: "sizes",
      label: "Размеры",
      isSortable: false,
      render: (item) =>
        item.type === "OTHER" ? (
          "Без размера"
        ) : (
          <button
            className="admin-secondary-button"
            onClick={() => onOpenSizes(item.id)}
          >
            Размеры ({item.sizes.filter((s) => s.isActive).length})
          </button>
        ),
    },
  ];
}
