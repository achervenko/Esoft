import { Injectable } from '@nestjs/common';
import { EquipmentEventStatus, Prisma } from '@prisma/client';
import { EquipmentEventAccessAssertions } from './equipment-event-access.assertions';
import { EquipmentEventChecklistAssertions } from './equipment-event-checklist.assertions';
import {
  throwEquipmentEventBadRequest,
  throwEquipmentEventConflict,
  throwEquipmentEventNotFound,
} from './equipment-events.errors';

@Injectable()
export class EquipmentEventStateAssertions {
  constructor(
    private readonly accessAssertions: EquipmentEventAccessAssertions,
    private readonly checklistAssertions: EquipmentEventChecklistAssertions,
  ) {}

  async assertEventCanBeCompleted(
    tx: Prisma.TransactionClient,
    eventId: number,
    userId?: string | null,
  ) {
    const event = await tx.equipmentEvent.findUnique({
      where: { id: eventId },
      select: {
        factDate: true,
        id: true,
        responsibles: {
          select: {
            userId: true,
          },
        },
        status: true,
      },
    });

    if (!event) {
      throwEquipmentEventNotFound(
        'EVENT_NOT_FOUND',
        'Событие оборудования не найдено.',
      );
    }

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

    this.accessAssertions.assertAssignedResponsible(event.responsibles, userId);
    await this.checklistAssertions.assertRequiredChecklistsCompleted(
      tx,
      eventId,
    );

    return event;
  }

  async assertEventCanBeCancelled(
    tx: Prisma.TransactionClient,
    eventId: number,
  ) {
    const event = await tx.equipmentEvent.findUnique({
      where: { id: eventId },
      select: { id: true, status: true },
    });

    if (!event) {
      throwEquipmentEventNotFound(
        'EVENT_NOT_FOUND',
        'Событие оборудования не найдено.',
      );
    }

    if (
      event.status !== EquipmentEventStatus.CREATED &&
      event.status !== EquipmentEventStatus.IN_PROGRESS
    ) {
      throwEquipmentEventConflict(
        'EVENT_STATUS_CONFLICT',
        'Событие в текущем статусе нельзя отменить.',
      );
    }

    return event;
  }

  async assertEventCanBeStarted(
    tx: Prisma.TransactionClient,
    eventId: number,
    userId?: string | null,
  ) {
    const event = await tx.equipmentEvent.findUnique({
      where: { id: eventId },
      select: {
        id: true,
        responsibles: {
          select: {
            userId: true,
          },
        },
        status: true,
      },
    });

    if (!event) {
      throwEquipmentEventNotFound(
        'EVENT_NOT_FOUND',
        'Событие оборудования не найдено.',
      );
    }

    if (event.status !== EquipmentEventStatus.CREATED) {
      throwEquipmentEventConflict(
        'EVENT_STATUS_CONFLICT',
        'Событие в текущем статусе нельзя взять в работу.',
      );
    }

    this.accessAssertions.assertAssignedResponsible(event.responsibles, userId);

    return event;
  }
}
