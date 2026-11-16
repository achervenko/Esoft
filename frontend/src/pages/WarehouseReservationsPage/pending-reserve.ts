import type { ReserveInput } from "../../shared/api/warehouse-reservations-api";

export const pendingReserveKey = (actorId: string) =>
  `warehouse:reserve:${actorId}`;

export function readPendingReserve(
  actorId?: string | null,
): ReserveInput | null {
  if (!actorId) return null;
  try {
    const value = JSON.parse(
      sessionStorage.getItem(pendingReserveKey(actorId)) ?? "null",
    ) as ReserveInput | null;
    return value?.requestKey ? value : null;
  } catch {
    return null;
  }
}
