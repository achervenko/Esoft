import { createTransfersTestRunner } from "./warehouse-transfers-test-context.mjs";
import { verifyTransfersBasic } from "./warehouse-transfers.basic.mjs";
import { verifyTransfersReservations } from "./warehouse-transfers.reservations.mjs";
import { verifyTransfersIdempotency } from "./warehouse-transfers.idempotency.mjs";
import { verifyTransfersValidation } from "./warehouse-transfers.validation.mjs";
import { verifyTransfersConcurrency } from "./warehouse-transfers.concurrency.mjs";

export async function verifyTransfers(prisma, database, t) {
  const run = createTransfersTestRunner(prisma, database, t);
  for (const verify of [
    verifyTransfersBasic,
    verifyTransfersReservations,
    verifyTransfersIdempotency,
    verifyTransfersValidation,
    verifyTransfersConcurrency,
  ])
    await verify(run);
}
