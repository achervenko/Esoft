import { Injectable } from '@nestjs/common';
import { EventExtensionCode, Prisma } from '@prisma/client';
import { throwEquipmentEventNotFound } from './equipment-events.errors';

@Injectable()
export class EquipmentEventStateAssertions {
  async assertEquipmentEventExists(
    tx: Prisma.TransactionClient,
    eventId: number,
  ) {
    const event = await tx.event.findFirst({
      where: {
        id: eventId,
        extensionCode: EventExtensionCode.EQUIPMENT,
        equipmentExtension: {
          is: {},
        },
      },
      select: {
        id: true,
      },
    });

    if (!event) {
      throwEquipmentEventNotFound(
        'EVENT_NOT_FOUND',
        'Событие оборудования не найдено.',
      );
    }

    return event;
  }
}
