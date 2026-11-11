import type { Reservation } from "../../shared/api/warehouse-reservations-api";
export type ReservationOperation =
  | { kind: "reserve" }
  | { kind: "decrease" | "restore"; reservation: Reservation }
  | { kind: "reduce"; reservation: Reservation; locationId: string };
export const operationTitles = {
  reserve: "Добавить резерв",
  decrease: "Уменьшить резерв",
  reduce: "Снять обеспеченность",
  restore: "Обеспечить",
};
