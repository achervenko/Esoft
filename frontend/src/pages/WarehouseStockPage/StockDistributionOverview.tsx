import "./StockConsolidationForm.css";
import { Forklift } from "lucide-react";
import { Notice } from "../../shared/ui/Notice";
import type {
  StockPosition,
  StockDistribution,
} from "../../shared/api/warehouse-stock-api";
import { StockTransferProduct } from "./StockTransferPreview";
import { quantityMillis } from "./stock-page.utils";
import {
  StockDistributionTable,
  type StockDistributionActions,
} from "./StockDistributionTable";
export function StockDistributionOverview({
  position,
  data,
  loading,
  error,
  canTransfer,
  canAdjust,
  onTransfer,
  onAdjust,
  onReservation,
  refresh,
  onConsolidate,
}: StockDistributionActions & {
  position: StockPosition;
  data: StockDistribution | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
  onConsolidate: () => void;
}) {
  const hasLocations = !!data?.locations.some(
    (b) => (quantityMillis(b.quantity) ?? 0n) > 0n || b.reservations.length > 0,
  );
  const current = data ?? {
    item: position.item,
    warehouse: position.warehouse,
    totalQuantity: position.quantity,
  };
  return (
    <div className="admin-form">
      <StockTransferProduct data={current} />
      {loading && <p role="status">Обновление распределения…</p>}
      {error && (
        <Notice tone="error">
          {error}
          <button
            type="button"
            className="admin-secondary-button"
            onClick={refresh}
          >
            Повторить загрузку
          </button>
        </Notice>
      )}
      {data &&
        data.locations.some(
          (b) => (quantityMillis(b.shortage ?? "0") ?? 0n) > 0n,
        ) && (
          <Notice tone="info">
            Есть необеспеченные резервы. Заимствованный товар восстанавливается
            отдельно; обычное поступление автоматически резерв не меняет.
          </Notice>
        )}
      {data && hasLocations && (
        <StockDistributionTable
          data={data}
          loading={loading}
          error={error}
          canTransfer={canTransfer}
          canAdjust={canAdjust}
          onTransfer={onTransfer}
          onAdjust={onAdjust}
          onReservation={onReservation}
        />
      )}
      {data && !hasLocations && <p>Остатки в местах хранения отсутствуют.</p>}
      {data && canTransfer && (
        <button
          type="button"
          className="admin-secondary-button stock-transfer-icon-button stock-consolidation-button"
          aria-label="Переместить всё"
          title="Переместить всё"
          disabled={
            loading ||
            !!error ||
            !data.item.isActive ||
            !data.warehouse.isActive ||
            data.locations.some(
              (b) => (quantityMillis(b.physicalShortage ?? "0") ?? 0n) > 0n,
            ) ||
            (quantityMillis(data.totalQuantity) ?? 0n) <= 0n
          }
          onClick={onConsolidate}
        >
          <span className="stock-consolidation-icons" aria-hidden="true">
            <Forklift size={20} />
            <Forklift size={20} />
          </span>
        </button>
      )}
    </div>
  );
}
