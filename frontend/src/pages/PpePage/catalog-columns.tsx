import type { PpeItem } from "../../shared/api/ppe";
import type { DataTableColumn } from "../../shared/ui/DataTable";
import { typeLabels } from "../../modules/ppe-ui/ppe-presentation";

export function createCatalogColumns(
  onOpenSizes: (id: number) => void,
): DataTableColumn<PpeItem, string>[] {
  return [
    {
      key: "article",
      className: "ppe-catalog-article-column",
      label: "Артикул",
      render: (item) => <>
        <strong>{item.article}</strong>
        {!item.isActive && <span className="ppe-visually-hidden">Неактивная позиция</span>}
      </>,
      sortValue: (item) => item.article,
    },
    {
      key: "name",
      className: "ppe-catalog-name-column",
      label: "Наименование",
      render: (item) => item.name,
      sortValue: (item) => item.name,
    },
    {
      key: "type",
      className: "ppe-catalog-type-column",
      label: "Тип СИЗ",
      render: (item) => typeLabels[item.type],
      sortValue: (item) => typeLabels[item.type],
    },
    {
      key: "status",
      className: "ppe-catalog-status-column",
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
      className: "ppe-catalog-sizes-column",
      label: "Размеры",
      isSortable: false,
      render: (item) =>
        item.type === "OTHER" ? (
          "Без размера"
        ) : (
          <button
            type="button"
            className="admin-secondary-button ppe-catalog-sizes-button"
            onClick={() => onOpenSizes(item.id)}
          >
            Размеры ({item.sizes.filter((s) => s.isActive).length})
          </button>
        ),
    },
  ];
}
