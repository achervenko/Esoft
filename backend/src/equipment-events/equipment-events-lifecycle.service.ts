import { Injectable } from '@nestjs/common';
import { EquipmentEventStatus, Prisma } from '@prisma/client';
import {
  ChecklistEventCompletionService,
  type LockedEventChecklistForCompletion,
} from '../checklists/checklist-work/checklist-event-completion.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  getEquipmentEventAuditSnapshot,
  writeEquipmentEventStatusAudit,
} from './equipment-events.audit';
import { EquipmentEventStateAssertions } from './equipment-event-state.assertions';
import {
  throwEquipmentEventBadRequest,
  throwEquipmentEventConflict,
} from './equipment-events.errors';
import { EquipmentEventsQueryService } from './equipment-events-query.service';

@Injectable()
export class EquipmentEventsLifecycleService {
  constructor(
    private readonly checklistEventCompletionService: ChecklistEventCompletionService,
    private readonly stateAssertions: EquipmentEventStateAssertions,
    private readonly prisma: PrismaService,
    private readonly queryService: EquipmentEventsQueryService,
  ) {}

  async cancel(id: number, userId?: string | null) {
    const updatedEventId = await this.prisma.$transaction(async (tx) => {
      const event = await this.stateAssertions.assertEventCanBeCancelled(
        tx,
        id,
      );
      const activeChecklists = await this.lockActiveChecklists(tx, id);

      const updateResult = await tx.equipmentEvent.updateMany({
        where: {
          id,
          status: {
            in: [
              EquipmentEventStatus.CREATED,
              EquipmentEventStatus.IN_PROGRESS,
            ],
          },
        },
        data: {
          status: EquipmentEventStatus.CANCELLED,
          version: {
            increment: 1,
          },
        },
      });

      if (updateResult.count !== 1) {
        throwEquipmentEventConflict(
          'EVENT_STATUS_CONFLICT',
          'Событие в текущем статусе нельзя отменить.',
        );
      }

      if (!userId) {
        throwEquipmentEventBadRequest(
          'SESSION_REQUIRED',
          'Сессия пользователя не найдена.',
        );
      }

      await this.checklistEventCompletionService.cancelActiveChecklistsForCancelledEvent(
        tx,
        activeChecklists,
        userId,
      );

      const auditSnapshot = await getEquipmentEventAuditSnapshot(tx, id);
      await writeEquipmentEventStatusAudit(tx, {
        event: auditSnapshot,
        newStatus: EquipmentEventStatus.CANCELLED,
        oldStatus: event.status,
        userId,
      });

      return id;
    });

    return this.queryService.findOne(updatedEventId);
  }

  private lockActiveChecklists(tx: Prisma.TransactionClient, eventId: number) {
    return tx.$queryRaw<LockedEventChecklistForCompletion[]>`
      SELECT
        id,
        status
      FROM checklists
      WHERE equipment_event_id = ${eventId}
        AND status IN ('CREATED', 'IN_PROGRESS')
      ORDER BY id
      FOR UPDATE
    `;
  }
}
