import { useMediaQuery } from "../../shared/lib/useMediaQuery";
import { useWindowedGrid } from "../../shared/lib/useWindowedGrid";
import { Badge } from "@chakra-ui/react";
import type { ReservationOrderSummary } from "../../shared/api/warehouse-reservations-api";
import { DataTable, type DataTableColumn } from "../../shared/ui/DataTable";

export function ReservationOrdersTable({
  items,
  onOpen,
}: {
  items: ReservationOrderSummary[];
  onOpen: (order: ReservationOrderSummary) => void;
}) {
  const mobile = useMediaQuery("(max-width: 1100px)");
  const cards = useWindowedGrid(mobile ? items.length : 0);
  if (mobile)
    return (
      <div
        className="reservation-order-cards"
        ref={cards.gridRef}
        role="list"
        aria-label="Заказы с резервами"
      >
        {cards.before > 0 && (
          <div aria-hidden="true" style={{ height: cards.before }} />
        )}
        {items.slice(cards.start, cards.end).map((r, index) => (
          <div
            role="listitem"
            key={r.order.id}
            data-grid-index={cards.start + index}
          >
            <div
              className="reservation-order-card"
              data-closed={r.order.closed}
            >
              <span className="reservation-order-card-heading">
                <strong>{r.order.number}</strong>
                <Badge
                  colorPalette={
                    r.deficitPositionsCount > 0 ? "orange" : "green"
                  }
                >
                  {r.deficitPositionsCount > 0 ? "Есть дефицит" : "Обеспечен"}
                </Badge>
              </span>
              {r.order.name.trim() && (
                <span className="reservation-order-card-name">
                  {r.order.name}
                </span>
              )}
              <span className="reservation-order-card-footer">
                <button
                  type="button"
                  className="admin-secondary-button"
                  onClick={() => onOpen(r)}
                >
                  Позиций: {r.positionsCount}
                </button>
              </span>
            </div>
          </div>
        ))}
        {cards.after > 0 && (
          <div aria-hidden="true" style={{ height: cards.after }} />
        )}
      </div>
    );
  const columns: DataTableColumn<ReservationOrderSummary, string>[] = [
    {
      key: "number",
      label: "Заказ",
      isSortable: false,
      render: (r) => <strong>{r.order.number}</strong>,
    },
    {
      key: "name",
      label: "Наименование",
      isSortable: false,
      render: (r) => r.order.name.trim() || "—",
    },
    {
      key: "positions",
      label: "Позиций",
      isSortable: false,
      render: (r) => (
        <button
          type="button"
          className="admin-secondary-button"
          aria-label={`Позиции заказа ${r.order.number}: ${r.positionsCount}`}
          onClick={() => onOpen(r)}
        >
          {r.positionsCount}
        </button>
      ),
    },
    {
      key: "coverage",
      label: "Состояние",
      isSortable: false,
      render: (r) => (
        <Badge
          colorPalette={r.deficitPositionsCount > 0 ? "orange" : "green"}
          whiteSpace="normal"
        >
          {r.deficitPositionsCount > 0 ? "Есть дефицит" : "Обеспечен"}
        </Badge>
      ),
    },
  ];
  return (
    <DataTable
      rows={items}
      columns={columns}
      getRowKey={(r) => r.order.id}
      getRowClassName={(r) =>
        r.order.closed ? "reservation-order-closed" : undefined
      }
      defaultSort={{ key: "number", direction: "asc" }}
      serverSorted
      windowed
    />
  );
}
