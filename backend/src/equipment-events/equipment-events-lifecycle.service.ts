import { Injectable } from '@nestjs/common';
import { EquipmentEventStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  getEquipmentEventAuditSnapshot,
  writeEquipmentEventStatusAudit,
  writeEquipmentEventUpdatedAudit,
} from './equipment-events.audit';
import { EquipmentEventStateAssertions } from './equipment-event-state.assertions';
import {
  throwEquipmentEventBadRequest,
  throwEquipmentEventConflict,
} from './equipment-events.errors';
import { EquipmentEventsQueryService } from './equipment-events-query.service';
import { type CompleteEquipmentEventData } from './equipment-events.validation';

@Injectable()
export class EquipmentEventsLifecycleService {
  constructor(
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
      const event = await this.stateAssertions.assertEventCanBeCompleted(
        tx,
        id,
        userId,
      );

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

      await this.cancelActiveChecklists(tx, id, userId);

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

  private async cancelActiveChecklists(
    tx: Prisma.TransactionClient,
    eventId: number,
    userId?: string | null,
  ) {
    if (!userId) {
      throwEquipmentEventBadRequest(
        'SESSION_REQUIRED',
        'Сессия пользователя не найдена.',
      );
    }

    await tx.$executeRaw`
      UPDATE checklists
      SET
        status = 'CANCELLED',
        cancelled_at = now(),
        cancelled_by = ${userId},
        cancellation_reason = 'Событие оборудования отменено.'
      WHERE equipment_event_id = ${eventId}
        AND status IN ('CREATED', 'IN_PROGRESS')
    `;
  }
}
