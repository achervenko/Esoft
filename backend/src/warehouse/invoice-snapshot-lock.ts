import type { Prisma } from '@prisma/client';

export async function lockInvoiceSnapshot(
  tx: Prisma.TransactionClient,
  invoiceId: string,
) {
  const key = JSON.stringify(['warehouse:receipt-sync', invoiceId]);
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${key},0))`;
}
