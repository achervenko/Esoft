import type { ReservationOperation } from "./reservation-operation";
import { ListLoadMore } from "../../shared/ui/ListLoadMore";
import { Notice } from "../../shared/ui/Notice";
import type { useReservationOrder } from "./useReservationOrder";
import { useReservationWindow } from "./useReservationWindow";
import { ReservationItemRow } from "./ReservationItemRow";

const emptyItems: NonNullable<
  ReturnType<typeof useReservationOrder>["list"]["data"]
>["items"] = [];
export function ReservationItemsList({
  list,
  expanded,
  onToggle,
  filtered,
  permissions,
  onOperation,
}: {
  list: ReturnType<typeof useReservationOrder>["list"];
  expanded: ReadonlySet<string>;
  onToggle: (id: string) => void;
  filtered: boolean;
  permissions?: readonly string[] | null;
  onOperation?: (operation: ReservationOperation) => void;
}) {
  const items = list.data?.items ?? emptyItems;
  const window = useReservationWindow(items, expanded);
  return (
    <div
      className="reservation-modal-scroll"
      ref={window.scrollRef}
      aria-label="Номенклатура заказа"
      aria-busy={list.loading}
    >
      {list.loading && !list.data && (
        <p className="reservation-modal-empty" role="status">
          Загрузка резервов…
        </p>
      )}
      {list.error && !list.data && (
        <Notice tone="error">
          {list.error}
          <button
            type="button"
            className="admin-secondary-button"
            onClick={list.retry}
          >
            Повторить
          </button>
        </Notice>
      )}
      {list.data && !items.length && (
        <p className="reservation-modal-empty">
          {filtered
            ? "Ничего не найдено"
            : "У заказа нет действующих резервов."}
        </p>
      )}
      <div ref={window.gridRef} className="reservation-window" role="list">
        {window.before > 0 && (
          <div aria-hidden="true" style={{ height: window.before }} />
        )}
        {items.slice(window.start, window.end).map((row, index) => (
          <div
            key={row.id}
            data-grid-index={window.start + index}
            role="listitem"
            aria-posinset={window.start + index + 1}
            aria-setsize={list.data?.total}
          >
            <ReservationItemRow
              permissions={permissions}
              onOperation={onOperation}
              reservation={row}
              expanded={expanded.has(row.id)}
              onToggle={() => onToggle(row.id)}
            />
          </div>
        ))}
        {window.after > 0 && (
          <div aria-hidden="true" style={{ height: window.after }} />
        )}
      </div>
      <ListLoadMore list={list} showCount={false} />
    </div>
  );
}
