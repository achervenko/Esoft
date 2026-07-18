import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { throwEquipmentEventConflict } from './equipment-events.errors';

@Injectable()
export class EquipmentEventChecklistAssertions {
  async assertAllChecklistsCompleted(
    tx: Prisma.TransactionClient,
    eventId: number,
  ) {
    const [checklistState] = await tx.$queryRaw<
      Array<{
        checklistCount: bigint;
        hasIncompleteChecklists: boolean;
      }>
    >`
      SELECT
        COUNT(*)::bigint AS "checklistCount",
        EXISTS (
          SELECT 1
          FROM checklists checklist
          WHERE checklist.equipment_event_id = ${eventId}
            AND checklist.status <> 'COMPLETED'
        ) AS "hasIncompleteChecklists"
      FROM checklists
      WHERE equipment_event_id = ${eventId}
    `;

    if (!checklistState || checklistState.checklistCount === 0n) {
      throwEquipmentEventConflict(
        'CHECKLISTS_REQUIRED',
        'У события должен быть хотя бы один чек-лист.',
      );
    }

    if (checklistState?.hasIncompleteChecklists) {
      throwEquipmentEventConflict(
        'CHECKLISTS_NOT_COMPLETED',
        'Завершите все чек-листы перед завершением события.',
      );
    }
  }
}
