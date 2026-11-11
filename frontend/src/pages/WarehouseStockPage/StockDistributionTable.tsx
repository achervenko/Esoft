import "./StockDistributionTable.css";
import { Forklift, Pencil } from "lucide-react";
import { AppTable } from "../../shared/ui/AppTable";
import type { StockDistribution } from "../../shared/api/warehouse-stock-api";
import { formatStockQuantity, quantityMillis } from "./stock-page.utils";
export type StockDistributionSource = {
  reservationId?: string;
  balance: StockDistribution["locations"][number];
};
export type StockDistributionActions = {
  canTransfer: boolean;
  canAdjust: boolean;
  canMoveReservations?: boolean;
  onTransfer: (source: StockDistributionSource) => void;
  onAdjust: (
    balance: StockDistribution["locations"][number],
    reservationId?: string,
  ) => void;
};
export function StockDistributionTable({
  data,
  loading,
  error,
  canTransfer,
  canAdjust,
  canMoveReservations = false,
  onTransfer,
  onAdjust,
}: StockDistributionActions & {
  data: StockDistribution;
  loading: boolean;
  error: string | null;
}) {
  return (
    <AppTable incremental={false}>
      <thead>
        <tr>
          <th>Место хранения</th>
          <th className="stock-distribution-quantity">Количество</th>
          {canTransfer && (
            <th
              className="stock-transfer-action-column"
              aria-label="Действия"
            />
          )}
        </tr>
      </thead>
      <tbody>
        {data.locations.flatMap((b) => {
          const rows = [
            ...((quantityMillis(b.freeQuantity) ?? 0n) > 0n &&
            (quantityMillis(b.quantity) ?? 0n) > 0n
              ? [{ quantity: b.freeQuantity, reservation: null }]
              : []),
            ...(b.reservations ?? [])
              .filter((r) => (quantityMillis(r.quantity) ?? 0n) > 0n)
              .map((reservation) => ({
                quantity: reservation.quantity,
                reservation,
              })),
          ];
          return rows.map(({ quantity, reservation }) => (
            <tr key={`${b.balanceId}:${reservation?.reservationId ?? "free"}`}>
              <td>
                {b.location.name}
                {!b.location.isActive && (
                  <small className="stock-inactive">Место неактивно</small>
                )}
                {reservation && (
                  <small className="stock-inactive">
                    Резерв: {reservation.order.number}
                  </small>
                )}
              </td>
              <td className="stock-distribution-quantity">
                <span
                  className={canAdjust ? "stock-quantity-editable" : undefined}
                >
                  <span className="stock-quantity-value">
                    {formatStockQuantity(quantity)} {data.item.unit}
                  </span>
                  {canAdjust && (
                    <button
                      type="button"
                      className="stock-adjust-button"
                      aria-label={`Исправить количество: ${b.location.name}`}
                      title="Исправить количество"
                      disabled={loading || !!error}
                      onClick={() => onAdjust(b, reservation?.reservationId)}
                    >
                      <Pencil size={16} aria-hidden="true" />
                    </button>
                  )}
                </span>
              </td>
              {canTransfer && (
                <td className="stock-transfer-action-column">
                  <button
                    type="button"
                    className="admin-secondary-button stock-transfer-icon-button"
                    aria-label="Переместить"
                    title="Переместить"
                    disabled={
                      loading ||
                      !!error ||
                      !data.item.isActive ||
                      !data.warehouse.isActive ||
                      !b.location.isActive ||
                      (!!reservation && !canMoveReservations)
                    }
                    onClick={() =>
                      onTransfer({
                        balance: b,
                        ...(reservation
                          ? { reservationId: reservation.reservationId }
                          : {}),
                      })
                    }
                  >
                    <Forklift size={20} aria-hidden="true" />
                  </button>
                </td>
              )}
            </tr>
          ));
        })}
      </tbody>
    </AppTable>
  );
}
