import { Injectable } from '@nestjs/common';
import { AuditAction, ChecklistStatus, Prisma } from '@prisma/client';
import { writeChecklistAudit } from '../checklist-common/checklists.audit';

const EVENT_CANCELLED_CANCELLATION_REASON = 'Событие оборудования отменено.';
const EVENT_CHECKLIST_ENTITY_TYPE = 'equipment_event_checklist';

export type LockedEventChecklistForCompletion = {
  id: number;
  status: ChecklistStatus;
};

@Injectable()
export class ChecklistEventCompletionService {
  // Precondition: the equipment event row has already been locked by the caller.
  async cancelActiveChecklistsForCancelledEvent(
    tx: Prisma.TransactionClient,
    checklists: LockedEventChecklistForCompletion[],
    userId: string,
  ) {
    return this.cancelChecklists(
      tx,
      checklists,
      userId,
      EVENT_CANCELLED_CANCELLATION_REASON,
    );
  }

  private async cancelChecklists(
    tx: Prisma.TransactionClient,
    checklists: LockedEventChecklistForCompletion[],
    userId: string,
    cancellationReason: string,
  ) {
    for (const checklist of checklists) {
      await tx.$executeRaw`
        UPDATE checklists
        SET
          status = 'CANCELLED',
          cancelled_at = now(),
          cancelled_by = ${userId},
          cancellation_reason = ${cancellationReason},
          version = version + 1
        WHERE id = ${checklist.id}
      `;
      await writeChecklistAudit(tx, {
        action: AuditAction.STATUS_CHANGE,
        entityId: checklist.id,
        entityType: EVENT_CHECKLIST_ENTITY_TYPE,
        fieldName: 'status',
        newValue: ChecklistStatus.CANCELLED,
        oldValue: checklist.status,
        userId,
      });
    }
  }
}
