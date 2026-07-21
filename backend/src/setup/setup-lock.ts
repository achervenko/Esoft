import { Prisma } from '@prisma/client';
import { SETUP_ADVISORY_LOCK_ID } from './setup.constants';

export function lockSetupTransaction(tx: Prisma.TransactionClient) {
  return tx.$queryRaw<Array<{ locked: number }>>`
    SELECT 1 AS locked
    FROM (
      SELECT pg_advisory_xact_lock(${SETUP_ADVISORY_LOCK_ID})
    ) AS setup_lock
  `;
}
