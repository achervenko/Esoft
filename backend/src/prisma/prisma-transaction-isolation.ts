import type { Prisma } from '@prisma/client';

export async function isReadCommitted(tx: Prisma.TransactionClient) {
  const [isolation] = await tx.$queryRaw<{ level: string }[]>`
    SELECT current_setting('transaction_isolation') AS level
  `;
  return isolation.level === 'read committed';
}
