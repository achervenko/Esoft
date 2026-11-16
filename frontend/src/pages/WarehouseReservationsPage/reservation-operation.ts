import type { Reservation } from "../../shared/api/warehouse-reservations-api";
export type ReservationOperation =
  | { kind: "reserve" }
  | { kind: "decrease"; reservation: Reservation }
  | { kind: "restore"; reservation: Reservation; canDecrease?: boolean }
  | {
      kind: "demand";
      reservation: Reservation;
      locationId?: string;
      canCover?: boolean;
    }
  | {
      kind: "reduce";
      reservation: Reservation;
      locationId: string;
      canDecrease?: boolean;
    };
export const operationTitles = {
  reserve: "Добавить резерв",
  decrease: "Уменьшить потребность резерва",
  demand: "Изменить потребность",
  reduce: "Изменить обеспеченность",
  restore: "Изменить обеспеченность",
};
