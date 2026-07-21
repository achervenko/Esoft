import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

const CHECKLIST_MODULES_ACTIVE_ORDER_LOCK_KEY =
  'checklist_modules_active_order';

@Injectable()
export class ChecklistModulesOrderLockService {
  async lock(tx: Prisma.TransactionClient) {
    await tx.$queryRaw<Array<{ locked: number }>>`
      SELECT 1 AS locked
      FROM (
        SELECT pg_advisory_xact_lock(hashtext(${CHECKLIST_MODULES_ACTIVE_ORDER_LOCK_KEY}))
      ) AS checklist_modules_order_lock
    `;
  }
}
