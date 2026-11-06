import type {
  StockDistribution,
  StockPosition,
  ReservationOperationInput,
} from "../../shared/api/warehouse-stock-api";
import type { StockDistributionSource } from "./StockDistributionTable";
export const reservationOperationKey =
  "warehouse:pending-reservation-operation";
export type PendingReservationOperation = {
  input: ReservationOperationInput;
  source: StockDistributionSource;
  data: StockDistribution;
  actorId: string;
};
export function readReservationOperation(): PendingReservationOperation | null {
  try {
    const saved = JSON.parse(
      sessionStorage.getItem(reservationOperationKey) ?? "null",
    );
    return saved?.input?.requestKey &&
      saved.source?.reservation?.id &&
      saved.data?.item?.id
      ? saved
      : null;
  } catch {
    return null;
  }
}
export function pendingReservationPosition(): StockPosition | null {
  const saved = readReservationOperation();
  if (!saved) return null;
  const { data } = saved;
  return {
    id: `${data.item.id}:${data.warehouse.id}`,
    item: data.item,
    warehouse: data.warehouse,
    quantity: data.totalQuantity,
    locationsCount: data.locations.length,
    locationsPreview: data.locations.map((b) => ({
      location: b.location,
      quantity: b.quantity,
    })),
  };
}
