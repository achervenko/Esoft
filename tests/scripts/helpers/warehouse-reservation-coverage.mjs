import { createCoverageFixture } from "./warehouse-reservation-coverage-fixture.mjs";
import {
  verifyBasicCoverage,
  verifyCoverageRollback,
} from "./warehouse-reservation-coverage-basic.mjs";
import { verifyConcurrentCoverage } from "./warehouse-reservation-coverage-concurrency.mjs";

export async function verifyReservationCoverage(
  c,
  t,
  Manager,
  manager,
  createOrder,
) {
  const fixture = () => createCoverageFixture(c, manager, createOrder);
  await verifyBasicCoverage(c, t, manager, createOrder, fixture);
  await verifyConcurrentCoverage(c, t, manager, createOrder, fixture);
  await verifyCoverageRollback(c, t, Manager, fixture);
}
