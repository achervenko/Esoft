import { randomUUID } from "node:crypto";
import { load } from "./adjustments-test-context.mjs";
export function setup(c, audit = c.audit) {
  const { WarehouseReservationOperationsService } = load(
    "warehouse/reservations/reservation-operations.service.js",
  );
  const { WarehouseReservationsService } = load(
    "warehouse/reservations/reservations.service.js",
  );
  return new WarehouseReservationOperationsService(
    c.prisma,
    c.stock,
    new WarehouseReservationsService(c.audit),
    audit,
    c.staged,
  );
}
export const input = (
  c,
  action,
  quantity,
  expectedQuantity = "18",
  expectedBorrowedQuantity = "0",
) => ({
  action,
  quantity,
  expectedQuantity,
  expectedBorrowedQuantity,
  requestKey: randomUUID(),
  comment: "Test operation",
  attachments: [],
});
