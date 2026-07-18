import { Injectable } from '@nestjs/common';
import { EquipmentEventStatus, Prisma } from '@prisma/client';
import {
  throwEquipmentEventConflict,
  throwEquipmentEventNotFound,
} from './equipment-events.errors';

@Injectable()
export class EquipmentEventStateAssertions {
  async assertEventCanBeCancelled(
    tx: Prisma.TransactionClient,
    eventId: number,
  ) {
    await this.lockEventForUpdate(tx, eventId);

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

  private async lockEventForUpdate(
    tx: Prisma.TransactionClient,
    eventId: number,
  ) {
    const lockedEvents = await tx.$queryRaw<Array<{ id: number }>>`
      SELECT id
      FROM equipment_events
      WHERE id = ${eventId}
      FOR UPDATE
    `;

    if (lockedEvents.length === 0) {
      throwEquipmentEventNotFound(
        'EVENT_NOT_FOUND',
        'Событие оборудования не найдено.',
      );
    }
  }
}
