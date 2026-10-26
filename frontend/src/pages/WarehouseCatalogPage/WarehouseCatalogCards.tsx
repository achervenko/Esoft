import { Image } from "lucide-react";
import type { WarehouseItem } from "../../shared/api/warehouse-catalog-api";
import { useWindowedGrid } from "../../shared/lib/useWindowedGrid";
export function WarehouseCatalogCards({
  items,
  canManage,
  onEdit,
}: {
  items: WarehouseItem[];
  canManage: boolean;
  onEdit: (item: WarehouseItem) => void;
}) {
  const gridWindow = useWindowedGrid(items.length);
  return (
    <div
      ref={gridWindow.gridRef}
      className="warehouse-catalog-cards"
      role="list"
      aria-label="Номенклатура склада"
    >
      {gridWindow.before > 0 && (
        <div
          aria-hidden="true"
          style={{ gridColumn: "1 / -1", height: gridWindow.before }}
        />
      )}
      {items.slice(gridWindow.start, gridWindow.end).map((item, index) => (
        <article
          data-grid-index={gridWindow.start + index}
          aria-posinset={gridWindow.start + index + 1}
          aria-setsize={items.length}
          role="listitem"
          key={item.id}
          aria-labelledby={`warehouse-item-${item.id}`}
          className={`warehouse-catalog-card${item.isActive ? "" : " inactive-surface"}`}
        >
          <div
            className="warehouse-catalog-photo"
            role="img"
            aria-label="Фотография скоро появится"
          >
            <Image aria-hidden="true" size={36} strokeWidth={1.4} />
            <span>Скоро здесь будет фотография</span>
          </div>
          <div className="warehouse-catalog-card-content">
            <h2
              id={`warehouse-item-${item.id}`}
              className="warehouse-catalog-article"
            >
              {item.article}
            </h2>
            <p className="warehouse-catalog-name">{item.name}</p>
            {canManage && (
              <div className="warehouse-catalog-card-actions">
                <button
                  type="button"
                  className="admin-secondary-button"
                  onClick={() => onEdit(item)}
                >
                  Изменить
                </button>
              </div>
            )}
          </div>
        </article>
      ))}
      {gridWindow.after > 0 && (
        <div
          aria-hidden="true"
          style={{ gridColumn: "1 / -1", height: gridWindow.after }}
        />
      )}
    </div>
  );
}
