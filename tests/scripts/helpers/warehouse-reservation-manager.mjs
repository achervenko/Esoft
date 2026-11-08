import { verifyReservationDecrease } from "./warehouse-reservation-decrease.mjs";
import { verifyReservationMove } from "./warehouse-reservation-move.mjs";
import { verifyReservationCoverage } from "./warehouse-reservation-coverage.mjs";
import { createReservationFixture } from "./warehouse-reservation-fixture.mjs";
import { verifyReservationCreate } from "./warehouse-reservation-create.mjs";
import { verifyReservationConcurrency } from "./warehouse-reservation-concurrency.mjs";
import { verifyReservationConsume } from "./warehouse-reservation-consume.mjs";

export async function verifyReservations(c, t) {
  const fixture = await createReservationFixture(c);
  const { WarehouseReservationManager, manager, createOrder } = fixture;
  await verifyReservationCreate(c, t, fixture);
  await verifyReservationConcurrency(c, t, fixture);

  await t.test("decrease and release", (suite) =>
    verifyReservationDecrease(c, suite, manager, createOrder),
  );
  await t.test("move allocations with physical stock", (suite) =>
    verifyReservationMove(
      c,
      suite,
      WarehouseReservationManager,
      manager,
      createOrder,
    ),
  );
  await t.test("change reservation coverage", (suite) =>
    verifyReservationCoverage(
      c,
      suite,
      WarehouseReservationManager,
      manager,
      createOrder,
    ),
  );
  await t.test("consume reserved stock", (suite) =>
    verifyReservationConsume(
      c,
      suite,
      WarehouseReservationManager,
      manager,
      createOrder,
    ),
  );
}
