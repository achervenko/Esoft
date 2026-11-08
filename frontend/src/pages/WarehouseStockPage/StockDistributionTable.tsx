import "./StockDistributionTable.css";
import { Forklift, Pencil } from "lucide-react";
import { AppTable } from "../../shared/ui/AppTable";
import type { StockDistribution } from "../../shared/api/warehouse-stock-api";
import { formatStockQuantity, quantityMillis } from "./stock-page.utils";
export type StockDistributionSource = {
  balance: StockDistribution["locations"][number];
};
export type StockDistributionActions = {
  canTransfer: boolean;
  canAdjust: boolean;
  onTransfer: (source: StockDistributionSource) => void;
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
          .filter((b) => (quantityMillis(b.quantity) ?? 0n) > 0n)
          .map((b) => (
            <tr key={b.balanceId}>
              <td>
                {b.location.name}
                {!b.location.isActive && (
                  <small className="stock-inactive">Место неактивно</small>
                )}
              </td>
              <td className="stock-distribution-quantity">
                <span
                  className={canAdjust ? "stock-quantity-editable" : undefined}
                >
                  <span className="stock-quantity-value">
                    {formatStockQuantity(b.quantity)} {data.item.unit}
                  </span>
                  {canAdjust && (
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
                      (quantityMillis(b.quantity) ?? 0n) <= 0n
                    }
                    onClick={() => onTransfer({ balance: b })}
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
