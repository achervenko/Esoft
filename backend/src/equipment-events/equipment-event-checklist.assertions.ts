import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { throwEquipmentEventConflict } from './equipment-events.errors';

@Injectable()
export class EquipmentEventChecklistAssertions {
  async assertRequiredChecklistsCompleted(
    tx: Prisma.TransactionClient,
    eventId: number,
  ) {
    const [checklistState] = await tx.$queryRaw<
      Array<{ hasIncompleteRequiredChecklists: boolean }>
    >`
      SELECT EXISTS (
        SELECT 1
        FROM checklists checklist
        WHERE checklist.equipment_event_id = ${eventId}
          AND checklist.is_required IS TRUE
          AND checklist.status <> 'COMPLETED'
      ) AS "hasIncompleteRequiredChecklists"
    `;

    if (checklistState?.hasIncompleteRequiredChecklists) {
      throwEquipmentEventConflict(
        'REQUIRED_CHECKLISTS_NOT_COMPLETED',
        'Завершите обязательные чек-листы перед завершением события.',
      );
    }
  }
}
