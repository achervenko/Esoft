import { createReservationsTestContext } from "./reservations-test-context.mjs";
import { verifyReservationsBasic } from "./reservations-basic.integration.mjs";
import { verifyReservationsConcurrency } from "./reservations-concurrency.integration.mjs";
import { verifyReservationsAudit } from "./reservations-audit.integration.mjs";
import { verifyReservationsPermissions } from "./reservations-permissions.integration.mjs";

export async function verifyReservations(prisma, test) {
  const context = await createReservationsTestContext(prisma);
  for (const [name, verify] of [
    [
      "basic: create, update, release, list, FK and inactive deficit",
      verifyReservationsBasic,
    ],
    [
      "concurrency: capacity, duplicate, PATCH and Issues races",
      verifyReservationsConcurrency,
    ],
    ["audit: no-op and rollback", verifyReservationsAudit],
    [
      "permissions: missing, banned and wrong role",
      verifyReservationsPermissions,
    ],
  ]) {
    await test.test(name, () => verify(context));
  }
}
