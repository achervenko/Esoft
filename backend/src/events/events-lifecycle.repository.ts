import { Injectable } from '@nestjs/common';
import { ChecklistStatus, EventStatus } from '@prisma/client';
import type { Prisma } from '@prisma/client';
import { throwEventConflict, throwEventNotFound } from './events.errors';

export type LockedEventState = {
  factDate: Date | null;
  id: number;
  status: EventStatus;
  version: number;
};

export type LockedActiveEventChecklist = {
  id: number;
  status: ChecklistStatus;
};

@Injectable()
export class EventsLifecycleRepository {
  async loadForUpdate(
    tx: Prisma.TransactionClient,
    eventId: number,
  ): Promise<LockedEventState> {
    await this.lockEventForUpdate(tx, eventId);

    const event = await tx.event.findUnique({
      where: { id: eventId },
      select: {
        factDate: true,
        id: true,
        status: true,
        version: true,
      },
    });

    if (!event) {
      throwEventNotFound('EVENT_NOT_FOUND', 'Событие не найдено.');
    }

    return event;
  }

  async updateStatus(
    tx: Prisma.TransactionClient,
    params: {
      conflictCode: 'EVENT_STATUS_CONFLICT' | 'EVENT_VERSION_CONFLICT';
      conflictMessage: string;
      data?: Prisma.EventUpdateManyMutationInput;
      eventId: number;
      expectedStatus: EventStatus;
      expectedVersion?: number;
      status: EventStatus;
    },
  ): Promise<void> {
    const updateResult = await tx.event.updateMany({
      where: {
        id: params.eventId,
        status: params.expectedStatus,
        ...(params.expectedVersion !== undefined
          ? { version: params.expectedVersion }
          : {}),
      },
      data: {
        ...params.data,
        status: params.status,
        version: {
          increment: 1,
        },
      },
    });

    if (updateResult.count !== 1) {
      throwEventConflict(params.conflictCode, params.conflictMessage);
    }
  }

  lockActiveChecklists(
    tx: Prisma.TransactionClient,
    eventId: number,
  ): Promise<LockedActiveEventChecklist[]> {
    return tx.$queryRaw<LockedActiveEventChecklist[]>`
      SELECT
        id,
        status
      FROM checklists
      WHERE event_id = ${eventId}
        AND status IN ('CREATED', 'IN_PROGRESS')
      ORDER BY id
      FOR UPDATE
    `;
  }

  async hasIncompleteChecklists(
    tx: Prisma.TransactionClient,
    eventId: number,
  ): Promise<boolean> {
    const [state] = await tx.$queryRaw<Array<{ hasIncomplete: boolean }>>`
      SELECT EXISTS (
        SELECT 1
        FROM checklists
        WHERE event_id = ${eventId}
          AND status <> ${ChecklistStatus.COMPLETED}::checklist_status
      ) AS "hasIncomplete"
    `;

    return state?.hasIncomplete ?? false;
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
