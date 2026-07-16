import { Injectable } from '@nestjs/common';
import { ChecklistStatus, EquipmentEventStatus, Prisma } from '@prisma/client';
import {
  ChecklistEventCompletionService,
  type LockedEventChecklistForCompletion,
} from '../checklists/checklist-work/checklist-event-completion.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  getEquipmentEventAuditSnapshot,
  writeEquipmentEventStatusAudit,
  writeEquipmentEventUpdatedAudit,
} from './equipment-events.audit';
import { EquipmentEventAccessAssertions } from './equipment-event-access.assertions';
import { EquipmentEventChecklistAssertions } from './equipment-event-checklist.assertions';
import { EquipmentEventStateAssertions } from './equipment-event-state.assertions';
import {
  throwEquipmentEventBadRequest,
  throwEquipmentEventConflict,
  throwEquipmentEventNotFound,
} from './equipment-events.errors';
import { EquipmentEventsQueryService } from './equipment-events-query.service';
import { type CompleteEquipmentEventData } from './equipment-events.validation';

@Injectable()
export class EquipmentEventsLifecycleService {
  constructor(
    private readonly accessAssertions: EquipmentEventAccessAssertions,
    private readonly checklistAssertions: EquipmentEventChecklistAssertions,
    private readonly checklistEventCompletionService: ChecklistEventCompletionService,
    private readonly stateAssertions: EquipmentEventStateAssertions,
    private readonly prisma: PrismaService,
    private readonly queryService: EquipmentEventsQueryService,
  ) {}

  async complete(
    id: number,
    data: CompleteEquipmentEventData,
    userId?: string | null,
  ) {
    const updatedEventId = await this.prisma.$transaction(async (tx) => {
      const event = await this.lockEventForCompletion(tx, id);

      if (event.status !== EquipmentEventStatus.IN_PROGRESS) {
        throwEquipmentEventConflict(
          'EVENT_STATUS_CONFLICT',
          'Событие в текущем статусе нельзя завершить.',
        );
      }

      if (event.responsibles.length === 0) {
        throwEquipmentEventBadRequest(
          'RESPONSIBLES_REQUIRED',
          'У события должен быть хотя бы один ответственный.',
        );
      }

      this.accessAssertions.assertAssignedResponsible(
        event.responsibles,
        userId,
      );
      const activeChecklists = await this.lockActiveChecklists(tx, id);
      await this.checklistAssertions.assertRequiredChecklistsCompleted(tx, id);

      const factDate = data.factDate ?? event.factDate;

      if (!factDate) {
        throwEquipmentEventBadRequest(
          'FACT_DATE_REQUIRED',
          'Укажите фактическую дату события.',
        );
      }

      const oldAuditSnapshot = await getEquipmentEventAuditSnapshot(tx, id);

      const updateResult = await tx.equipmentEvent.updateMany({
        where: {
          id,
          status: EquipmentEventStatus.IN_PROGRESS,
        },
        data: {
          factDate,
          status: EquipmentEventStatus.COMPLETED,
          version: {
            increment: 1,
          },
        },
      });

      if (updateResult.count !== 1) {
        throwEquipmentEventConflict(
          'EVENT_STATUS_CONFLICT',
          'Событие в текущем статусе нельзя завершить.',
        );
      }

      const auditSnapshot = await getEquipmentEventAuditSnapshot(tx, id);
      await writeEquipmentEventStatusAudit(tx, {
        event: auditSnapshot,
        newStatus: EquipmentEventStatus.COMPLETED,
        oldStatus: event.status,
        userId,
      });
      await writeEquipmentEventUpdatedAudit(tx, {
        newEvent: auditSnapshot,
        oldEvent: oldAuditSnapshot,
        userId,
      });

      if (!userId) {
        throwEquipmentEventBadRequest(
          'SESSION_REQUIRED',
          'Сессия пользователя не найдена.',
        );
      }

      await this.checklistEventCompletionService.cancelOptionalActiveChecklistsForCompletedEvent(
        tx,
        activeChecklists,
        userId,
      );

      return id;
    });

    return this.queryService.findOne(updatedEventId);
  }

  async start(id: number, userId?: string | null) {
    const updatedEventId = await this.prisma.$transaction(async (tx) => {
      const event = await this.stateAssertions.assertEventCanBeStarted(
        tx,
        id,
        userId,
      );

      const updateResult = await tx.equipmentEvent.updateMany({
        where: {
          id,
          status: EquipmentEventStatus.CREATED,
        },
        data: {
          status: EquipmentEventStatus.IN_PROGRESS,
          version: {
            increment: 1,
          },
        },
      });

      if (updateResult.count !== 1) {
        throwEquipmentEventConflict(
          'EVENT_STATUS_CONFLICT',
          'Событие в текущем статусе нельзя взять в работу.',
        );
      }

      const auditSnapshot = await getEquipmentEventAuditSnapshot(tx, id);
      await writeEquipmentEventStatusAudit(tx, {
        event: auditSnapshot,
        newStatus: EquipmentEventStatus.IN_PROGRESS,
        oldStatus: event.status,
        userId,
      });

      return id;
    });

    return this.queryService.findOne(updatedEventId);
  }

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

  private async lockEventForCompletion(
    tx: Prisma.TransactionClient,
    eventId: number,
  ) {
    const [event] = await tx.$queryRaw<
      Array<{
        factDate: Date | null;
        id: number;
        status: EquipmentEventStatus;
      }>
    >`
      SELECT id, status, fact_date AS "factDate"
      FROM equipment_events
      WHERE id = ${eventId}
      FOR UPDATE
    `;

    if (!event) {
      throwEquipmentEventNotFound(
        'EVENT_NOT_FOUND',
        'Событие оборудования не найдено.',
      );
    }

    const responsibles = await tx.equipmentEventResponsible.findMany({
      where: { equipmentEventId: eventId },
      select: { userId: true },
    });

    return {
      ...event,
      responsibles,
    };
  }

  private lockActiveChecklists(
    tx: Prisma.TransactionClient,
    eventId: number,
  ) {
    return tx.$queryRaw<LockedEventChecklistForCompletion[]>`
      SELECT
        id,
        is_required AS "isRequired",
        status
      FROM checklists
      WHERE equipment_event_id = ${eventId}
        AND status IN ('CREATED', 'IN_PROGRESS')
      ORDER BY id
      FOR UPDATE
    `;
  }
}
