import type { OrderData } from "../../shared/api/orders-api";
import { useWindowedGrid } from "../../shared/lib/useWindowedGrid";
import { OrderStatus } from "./OrderStatus";

export function OrdersListCards({
  items,
  loading,
}: {
  items: OrderData[];
  loading: boolean;
}) {
  const window = useWindowedGrid(items.length);
  return (
    <div className="orders-list" ref={window.gridRef} aria-busy={loading}>
      {window.before > 0 && (
        <div aria-hidden="true" style={{ height: window.before }} />
      )}
      {items.slice(window.start, window.end).map((row, index) => (
        <a
          className="admin-card orders-row"
          href={`#/orders/${row.id}`}
          key={row.id}
          data-grid-index={window.start + index}
        >
          <div className="orders-row-title">
            <strong className="orders-row-number">{row.number}</strong>
            {row.name.trim() && (
              <span className="orders-row-name" title={row.name}>
                {row.name}
              </span>
            )}
          </div>
          <div>
            <OrderStatus status={row.status} deleted={row.deletionMark} />
            {row.missingChecks === 2 && <p>Отсутствует в 1С</p>}
            {!row.posted && <p>Не проведён</p>}
          </div>
        </a>
      ))}
      {window.after > 0 && (
        <div aria-hidden="true" style={{ height: window.after }} />
      )}
    </div>
  );
}
