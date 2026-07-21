import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

const CHECKLIST_QUESTIONS_ACTIVE_ORDER_LOCK_PREFIX =
  'checklist_questions_active_order';

@Injectable()
export class ChecklistQuestionsOrderLockService {
  async lock(tx: Prisma.TransactionClient, checklistModuleId: number | null) {
    if (checklistModuleId === null) {
      // Unassigned questions are not part of the sortable active order.
      return;
    }

    await tx.$queryRaw<Array<{ locked: number }>>`
      SELECT 1 AS locked
      FROM (
        SELECT pg_advisory_xact_lock(
          hashtext(${this.getLockKey(checklistModuleId)})
        )
      ) AS checklist_questions_order_lock
    `;
  }

  async lockMany(
    tx: Prisma.TransactionClient,
    checklistModuleIds: Array<number | null | undefined>,
  ) {
    const moduleIds = Array.from(
      new Set(
        checklistModuleIds.filter((id): id is number => typeof id === 'number'),
      ),
    ).sort((left, right) => left - right);

    for (const moduleId of moduleIds) {
      await this.lock(tx, moduleId);
    }
  }

  private getLockKey(checklistModuleId: number) {
    return `${CHECKLIST_QUESTIONS_ACTIVE_ORDER_LOCK_PREFIX}:${checklistModuleId}`;
  }
}
