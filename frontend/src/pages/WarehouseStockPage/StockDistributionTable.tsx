import "./StockDistributionTable.css";
import { Forklift, Pencil } from "lucide-react";
import { AppTable } from "../../shared/ui/AppTable";
import type { StockDistribution } from "../../shared/api/warehouse-stock-api";
import { formatStockQuantity, quantityMillis } from "./stock-page.utils";
export type StockDistributionSource = {
  balance: StockDistribution["locations"][number];
  reservation?: StockDistribution["locations"][number]["reservations"][number];
};
export type StockDistributionActions = {
  canTransfer: boolean;
  canAdjust: boolean;
  onTransfer: (source: StockDistributionSource) => void;
  onReservation?: (source: StockDistributionSource) => void;
  onAdjust: (balance: StockDistribution["locations"][number]) => void;
};
export function StockDistributionTable({
  data,
  loading,
  error,
  canTransfer,
  canAdjust,
  onTransfer,
  onAdjust,
  onReservation,
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
        {data.locations
          .flatMap((balance) => [
            ...((quantityMillis(balance.available) ?? 0n) > 0n
              ? [{ balance, reservation: undefined, first: true }]
              : []),
            ...balance.reservations.map((reservation, index) => ({
              first:
                index === 0 && (quantityMillis(balance.available) ?? 0n) === 0n,
              balance,
              reservation,
            })),
          ])
          .map(({ balance: b, reservation, first }) => (
            <tr key={`${b.balanceId}:${reservation?.projectId ?? "free"}`}>
              <td>
                {b.location.name}
                <small className="stock-inactive">
                  {reservation
                    ? `Резерв · ${reservation.projectNumber}${reservation.projectName ? ` · ${reservation.projectName}` : ""}`
                    : "Свободно"}
                </small>
                {reservation &&
                  (quantityMillis(reservation.borrowedQuantity ?? "0") ?? 0n) >
                    0n && (
                    <small className="stock-inactive">
                      Заимствовано:{" "}
                      {formatStockQuantity(reservation.borrowedQuantity!)}{" "}
                      {data.item.unit}
                    </small>
                  )}
                {first && (quantityMillis(b.shortage ?? "0") ?? 0n) > 0n && (
                  <small className="stock-reservation-shortage">
                    Не хватает: {formatStockQuantity(b.shortage!)}{" "}
                    {data.item.unit}
                  </small>
                )}
                {!b.location.isActive && (
                  <small className="stock-inactive">Место неактивно</small>
                )}
              </td>
              <td className="stock-distribution-quantity">
                <span
                  className={
                    (canAdjust && first) ||
                    (reservation && onReservation && reservation.id)
                      ? "stock-quantity-editable"
                      : undefined
                  }
                >
                  <span className="stock-quantity-value">
                    {formatStockQuantity(reservation?.quantity ?? b.available)}{" "}
                    {data.item.unit}
                    {canAdjust && first && b.reservations.length > 0 && (
                      <small className="stock-inactive">
                        Всего: {formatStockQuantity(b.quantity)}{" "}
                        {data.item.unit}
                        {reservation && (
                          <button
                            type="button"
                            className="stock-adjust-button"
                            aria-label={`Исправить количество: ${b.location.name}`}
                            title="Исправить количество"
                            disabled={loading || !!error}
                            onClick={() => onAdjust(b)}
                          >
                            <Pencil size={16} aria-hidden="true" />
                          </button>
                        )}
                      </small>
                    )}
                  </span>
                  {reservation && onReservation && reservation.id && (
                    <button
                      type="button"
                      className="stock-adjust-button stock-reservation-action"
                      aria-label="Управлять резервом"
                      title="Управлять резервом"
                      disabled={loading || !!error}
                      onClick={() => onReservation({ balance: b, reservation })}
                    >
                      <Pencil size={16} aria-hidden="true" />
                    </button>
                  )}
                  {canAdjust && first && !reservation && (
                    <button
                      type="button"
                      className="stock-adjust-button"
                      aria-label={`Исправить количество: ${b.location.name}`}
                      title="Исправить количество"
                      disabled={loading || !!error}
                      onClick={() => onAdjust(b)}
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
                      (quantityMillis(
                        reservation?.movableQuantity ??
                          reservation?.quantity ??
                          b.available,
                      ) ?? 0n) <= 0n
                    }
                    onClick={() => onTransfer({ balance: b, reservation })}
                  >
                    <Forklift size={20} aria-hidden="true" />
                  </button>
                </td>
              )}
            </tr>
          ))}
      </tbody>
    </AppTable>
  );
}
