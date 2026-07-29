import { Injectable } from '@nestjs/common';
import { EventStatus, Prisma } from '@prisma/client';
import { EventsAccessAssertions } from './events-access.assertions';
import { throwEventConflict, throwEventNotFound } from './events.errors';
import type { CurrentCreatedEventState } from './events-update.types';

@Injectable()
export class EventsUpdateInputLoader {
  constructor(private readonly accessAssertions: EventsAccessAssertions) {}

  async loadValidCreatedUpdateInput(
    tx: Prisma.TransactionClient,
    params: {
      eventId: number;
      responsibleUserIds?: string[];
    },
  ): Promise<CurrentCreatedEventState> {
    await this.lockEventForUpdate(tx, params.eventId);

    const event = await tx.event.findUnique({
      where: { id: params.eventId },
      select: {
        checklists: {
          orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
          select: {
            assignedUserId: true,
            checklistTemplateId: true,
            id: true,
            sortOrder: true,
          },
        },
        note: true,
        plannedDate: true,
        responsibles: {
          select: {
            userId: true,
          },
        },
        status: true,
        title: true,
        version: true,
      },
    });

    if (!event) {
      throwEventNotFound('EVENT_NOT_FOUND', 'Событие не найдено.');
    }

    if (event.status !== EventStatus.CREATED) {
      throwEventConflict(
        'EVENT_STATUS_CONFLICT',
        'Изменять можно только событие до начала работ.',
      );
    }

    if (params.responsibleUserIds) {
      await this.accessAssertions.assertResponsibleUsersExist(
        tx,
        params.responsibleUserIds,
      );
    }

    return {
      currentChecklists: event.checklists,
      currentNote: event.note,
      currentPlannedDate: event.plannedDate,
      currentResponsibleUserIds: event.responsibles.map((item) => item.userId),
      currentTitle: event.title,
      version: event.version,
    };
  }

  private async lockEventForUpdate(
    tx: Prisma.TransactionClient,
    eventId: number,
  ): Promise<void> {
    const lockedEvents = await tx.$queryRaw<Array<{ id: number }>>`
      SELECT id
      FROM events
      WHERE id = ${eventId}
      FOR UPDATE
    `;

    if (lockedEvents.length === 0) {
      throwEventNotFound('EVENT_NOT_FOUND', 'Событие не найдено.');
    }
  }
}
