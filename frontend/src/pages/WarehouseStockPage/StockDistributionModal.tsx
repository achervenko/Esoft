import { readPendingStockMovement } from "./pending-stock-movement";
import { useState } from "react";
import { AdminModal } from "../../shared/ui/AdminModal";
import { type StockPosition } from "../../shared/api/warehouse-stock-api";
import "./StockTransferForm.css";
import { StockAdjustmentForm } from "./StockAdjustmentForm";
import { StockTransferForm } from "./StockTransferForm";
import { StockConsolidationForm } from "./StockConsolidationForm";
import { useStockDistribution } from "./useStockDistribution";
import { StockDistributionOverview } from "./StockDistributionOverview";
import type { StockDistributionSource } from "./StockDistributionTable";
export function StockDistributionModal({
  position,
  canTransfer,
  canAdjust = false,
  canMoveReservations = false,
  onClose,
  onChanged,
}: {
  position: StockPosition;
  canTransfer: boolean;
  canAdjust?: boolean;
  canMoveReservations?: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [restored, setRestored] = useState(() => {
    const saved = readPendingStockMovement();
    return saved?.data.item.id === position.item.id &&
      saved.data.warehouse.id === position.warehouse.id
      ? saved
      : null;
  });
  const { data, error, loading, refresh } = useStockDistribution(position);
  const [source, setSource] = useState<StockDistributionSource | null>(
    restored?.kind === "transfer" ? restored.source : null,
  );
  const [adjusting, setAdjusting] = useState<StockDistributionSource | null>(
    null,
  );
  const [transferSaving, setTransferSaving] = useState(false);
  const [consolidating, setConsolidating] = useState(
    restored?.kind === "consolidation",
  );
  const content = () => {
    const operationData =
      restored && (source || consolidating) ? restored.data : data;
    if (adjusting && data)
      return (
        <StockAdjustmentForm
          data={data}
          balance={adjusting.balance}
          portion={{
            ...(adjusting.reservationId
              ? { reservationId: adjusting.reservationId }
              : {}),
            quantity: adjusting.reservationId
              ? (adjusting.balance.reservations?.find(
                  (r) => r.reservationId === adjusting.reservationId,
                )?.quantity ?? "0")
              : adjusting.balance.freeQuantity,
          }}
          onSavingChange={setTransferSaving}
          onClose={() => setAdjusting(null)}
          onSaved={() => {
            setAdjusting(null);
            refresh();
            onChanged();
          }}
        />
      );
    if ((source || consolidating) && operationData)
      return (
        <>
          {consolidating ? (
            <StockConsolidationForm
              canMoveReservations={canMoveReservations}
              data={operationData}
              onSavingChange={setTransferSaving}
              onClose={() => {
                setRestored(null);
                setConsolidating(false);
              }}
              onSaved={() => {
                setRestored(null);
                setConsolidating(false);
                refresh();
                onChanged();
              }}
            />
          ) : (
            source && (
              <StockTransferForm
                canMoveReservations={canMoveReservations}
                reservationId={source.reservationId}
                embedded
                onSavingChange={setTransferSaving}
                data={operationData}
                source={
                  restored
                    ? source.balance
                    : (operationData.locations.find(
                        (b) => b.location.id === source.balance.location.id,
                      ) ?? source.balance)
                }
                onClose={() => {
                  setRestored(null);
                  setSource(null);
                }}
                onSaved={() => {
                  setRestored(null);
                  setSource(null);
                  refresh();
                  onChanged();
                }}
              />
            )
          )}
        </>
      );
    return (
      <StockDistributionOverview
        position={position}
        data={data}
        loading={loading}
        error={error}
        canTransfer={canTransfer}
        canAdjust={canAdjust}
        canMoveReservations={canMoveReservations}
        onTransfer={(next) => {
          setSource(next);
          refresh();
        }}
        onAdjust={(balance, reservationId) =>
          setAdjusting({ balance, reservationId })
        }
        refresh={refresh}
        onConsolidate={() => setConsolidating(true)}
      />
    );
  };
  const editing = !!(adjusting || source || consolidating);
  return (
    <AdminModal
      className="stock-transfer-modal"
      title={
        adjusting
          ? "Исправить количество"
          : consolidating
            ? "Переместить всё"
            : source
              ? "Переместить остаток"
              : `Места хранения (${data?.warehouse.name ?? position.warehouse.name})`
      }
      isCloseDisabled={editing && transferSaving}
      onClose={() => {
        if (!editing) {
          onClose();
          return;
        }
        setRestored(null);
        setAdjusting(null);
        setSource(null);
        setConsolidating(false);
      }}
    >
      {content()}
    </AdminModal>
  );
}
