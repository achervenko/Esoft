import { Image } from "lucide-react";
import { DataTable, type DataTableColumn } from "../../shared/ui/DataTable";
import { AsyncImage } from "../../shared/ui/AsyncImage";
import type { StockPosition } from "../../shared/api/warehouse-stock-api";
import type { StockSort } from "./useWarehouseStock";
import { formatStockQuantity, storagePlacesLabel } from "./stock-page.utils";
export function StockPhoto({ item }: { item: StockPosition["item"] }) {
  return (
    <span className="stock-photo">
      {item.photo ? (
        <AsyncImage src={item.photo} alt={item.name} />
      ) : (
        <Image size={24} aria-label="Нет фотографии" />
      )}
    </span>
  );
}
export function WarehouseStockTable({
  rows,
  sort,
  onSort,
  onOpen,
  disabled,
}: {
  rows: StockPosition[];
  sort: StockSort;
  onSort: (sort: StockSort) => void;
  onOpen: (row: StockPosition) => void;
  disabled: boolean;
}) {
  const places = (row: StockPosition) => (
    <button
      className="admin-secondary-button stock-storage-button"
      title={
        row.locationsCount <= 1
          ? row.locationsPreview[0]?.location.name
          : storagePlacesLabel(row.locationsCount)
      }
      disabled={disabled}
      onClick={() => onOpen(row)}
    >
      <span>
        {row.locationsCount <= 1
          ? (row.locationsPreview[0]?.location.name ??
            "Нет положительного остатка")
          : storagePlacesLabel(row.locationsCount)}
      </span>
    </button>
  );
  const columns: DataTableColumn<StockPosition, string>[] = [
    {
      key: "photo",
      className: "stock-column-photo",
      label: "",
      isSortable: false,
      render: (r) => <StockPhoto item={r.item} />,
    },
    {
      key: "article",
      className: "stock-column-article",
      label: "Артикул",
      sortValue: (r) => r.item.article,
      render: (r) => r.item.article,
    },
    {
      key: "name",
      label: "Наименование",
      sortValue: (r) => r.item.name,
      render: (r) => (
        <strong>
          {r.item.name}
          {!r.item.isActive && (
            <small className="stock-inactive">Номенклатура неактивна</small>
          )}
        </strong>
      ),
    },
    {
      key: "locations",
      className: "stock-column-locations",
      label: "Места хранения",
      isSortable: false,
      render: places,
    },
    {
      key: "quantity",
      className: "stock-column-quantity",
      label: "Количество",
      sortValue: (r) => r.quantity,
      render: (r) => `${formatStockQuantity(r.quantity)} ${r.item.unit}`,
    },
  ];
  return (
    <DataTable
      rows={rows}
      columns={columns}
      getRowKey={(r) => r.id}
      defaultSort={{ key: "article", direction: "asc" }}
      sort={sort}
      serverSorted
      windowed
      onSortChange={(s) => {
        if (
          s.key === "article" ||
          s.key === "name" ||
          s.key === "quantity" ||
          s.key === "warehouse"
        )
          onSort({ ...s, key: s.key });
      }}
    />
  );
}
