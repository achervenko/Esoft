import type { StockPosition } from "../../shared/api/warehouse-stock-api";
import { useWindowedGrid } from "../../shared/lib/useWindowedGrid";
import { StockPhoto } from "./WarehouseStockTable";
import { formatStockQuantity, storagePlacesLabel } from "./stock-page.utils";
export function WarehouseStockCards({
  rows,
  disabled,
  onOpen,
}: {
  rows: StockPosition[];
  disabled: boolean;
  onOpen: (row: StockPosition) => void;
}) {
  const gridWindow = useWindowedGrid(rows.length);
  return (
    <div
      ref={gridWindow.gridRef}
      className="stock-cards"
      role="list"
      aria-label="Остатки"
    >
      {gridWindow.before > 0 && (
        <div aria-hidden="true" style={{ height: gridWindow.before }} />
      )}
      {rows.slice(gridWindow.start, gridWindow.end).map((row, index) => (
        <article
          key={row.id}
          data-grid-index={gridWindow.start + index}
          role="listitem"
          className="stock-card"
        >
          <div className="stock-detail-heading">
            <StockPhoto item={row.item} />
            <div>
              <span>{row.item.article}</span>
              <h2>{row.item.name}</h2>
            </div>
          </div>
          <strong>
            {formatStockQuantity(row.quantity)} {row.item.unit}
          </strong>
          <p>Склад: {row.warehouse.name}</p>
          <button
            className="stock-distribution-link"
            disabled={disabled}
            onClick={() => onOpen(row)}
          >
            {row.locationsCount <= 1
              ? (row.locationsPreview[0]?.location.name ?? "Размещение")
              : storagePlacesLabel(row.locationsCount)}
          </button>
          {!row.item.isActive && <small>Номенклатура неактивна</small>}
        </article>
      ))}
      {gridWindow.after > 0 && (
        <div aria-hidden="true" style={{ height: gridWindow.after }} />
      )}
    </div>
  );
}
