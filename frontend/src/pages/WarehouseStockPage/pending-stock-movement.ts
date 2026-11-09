import {
  warehouseStockApi,
  type StockDistribution,
  type StockPosition,
  type StockTransferInput,
  type StockConsolidationInput,
} from "../../shared/api/warehouse-stock-api";
import type { StockDistributionSource } from "./StockDistributionTable";
const key = "warehouse:pending-movement";
type Common = {
  data: StockDistribution;
  warehouseId: string;
  actorId?: string;
};
export type PendingStockMovement = Common &
  (
    | {
        kind: "transfer";
        input: StockTransferInput;
        source: StockDistributionSource;
      }
    | { kind: "consolidation"; input: StockConsolidationInput }
  );
export function readPendingStockMovement(): PendingStockMovement | null {
  try {
    const saved = JSON.parse(sessionStorage.getItem(key) ?? "null");
    return saved &&
      ["transfer", "consolidation"].includes(saved.kind) &&
      saved.input?.requestKey &&
      saved.data?.item?.id &&
      saved.data?.warehouse?.id
      ? saved
      : null;
  } catch {
    return null;
  }
}
export async function persistStockMovement(record: PendingStockMovement) {
  const actorId = await warehouseStockApi.currentUserId();
  const previous = readPendingStockMovement();
  if (
    previous &&
    (previous.input.requestKey !== record.input.requestKey ||
      previous.actorId !== actorId)
  )
    throw new Error(
      "Сначала подтвердите предыдущее перемещение под тем же пользователем.",
    );
  sessionStorage.setItem(key, JSON.stringify({ ...record, actorId }));
}
export function clearPendingStockMovement(requestKey: string) {
  if (readPendingStockMovement()?.input.requestKey === requestKey)
    sessionStorage.removeItem(key);
}
export function pendingStockPosition(): StockPosition | null {
  const saved = readPendingStockMovement();
  if (!saved) return null;
  const { data } = saved;
  return {
    id: `${data.item.id}:${data.warehouse.id}`,
    item: data.item,
    warehouse: data.warehouse,
    quantity: data.totalQuantity,
    reservedQuantity: data.reservedQuantity,
    freeQuantity: data.freeQuantity,
    reservationMismatch: data.reservationMismatch,
    locationsCount: data.locations.length,
    locationsPreview: data.locations.map((b) => ({
      location: b.location,
      quantity: b.quantity,
      reservedQuantity: b.reservedQuantity,
      freeQuantity: b.freeQuantity,
      reservationMismatch: b.reservationMismatch,
    })),
  };
}
