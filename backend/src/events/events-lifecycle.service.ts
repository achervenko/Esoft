import { Injectable } from '@nestjs/common';
import { EventStatus } from '@prisma/client';
import type { Prisma } from '@prisma/client';
import { getBusinessTodayDate } from '../application/business-date';
import { ChecklistEventCompletionService } from '../checklists/checklist-work/checklist-event-completion.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  getEventAuditSnapshot,
  writeEventStatusAudit,
  writeEventUpdatedAudit,
} from './events.audit';
import { throwEventConflict } from './events.errors';
import {
  assertEventStatus,
  assertEventVersionMatches,
  requireLifecycleUserId,
} from './events-lifecycle.assertions';
import { EventsLifecycleRepository } from './events-lifecycle.repository';
import type {
  CancelEventData,
  CompleteEventData,
  EventLifecycleResult,
  InternalEventLifecycleData,
  StartEventData,
} from './events-lifecycle.types';

type EventLifecycleScopeOptions = {
  assertScope?: (
    tx: Prisma.TransactionClient,
    eventId: number,
  ) => Promise<void>;
};

@Injectable()
export class EventsLifecycleService {
  constructor(
    private readonly checklistEventCompletionService: ChecklistEventCompletionService,
    private readonly prisma: PrismaService,
    private readonly repository: EventsLifecycleRepository,
  ) {}

  start(
    id: number,
    data: StartEventData,
    userId?: string | null,
  ): Promise<EventLifecycleResult> {
    return this.prisma.$transaction((tx) =>
      this.startInTransaction(tx, id, data, userId),
    );
  }

  async startInTransaction(
    tx: Prisma.TransactionClient,
    id: number,
    data: StartEventData,
    userId?: string | null,
    options?: EventLifecycleScopeOptions,
  ): Promise<EventLifecycleResult> {
    const actorUserId = requireLifecycleUserId(userId);
    const event = await this.repository.loadForUpdate(tx, id);

    await options?.assertScope?.(tx, id);
    assertEventVersionMatches(event.version, data.version);
    assertEventStatus(
      event.status,
      [EventStatus.CREATED],
      'Событие в текущем статусе нельзя начать.',
    );

    await this.repository.updateStatus(tx, {
      conflictCode: 'EVENT_VERSION_CONFLICT',
      eventId: id,
      expectedStatus: EventStatus.CREATED,
      expectedVersion: data.version,
      status: EventStatus.IN_PROGRESS,
      conflictMessage: 'Событие в текущем статусе нельзя начать.',
    });
    await this.writeStatusAudit(tx, {
      eventId: id,
      newStatus: EventStatus.IN_PROGRESS,
      oldStatus: event.status,
      userId: actorUserId,
    });

    return { eventId: id };
  }

  complete(
    id: number,
    data: CompleteEventData,
    userId?: string | null,
  ): Promise<EventLifecycleResult> {
    return this.prisma.$transaction((tx) =>
      this.completeInTransaction(tx, id, data, userId),
    );
  }

  async completeInTransaction(
    tx: Prisma.TransactionClient,
    id: number,
    data: CompleteEventData,
    userId?: string | null,
    options?: EventLifecycleScopeOptions,
  ): Promise<EventLifecycleResult> {
    const actorUserId = requireLifecycleUserId(userId);
    const event = await this.repository.loadForUpdate(tx, id);

    await options?.assertScope?.(tx, id);
    assertEventVersionMatches(event.version, data.version);
    assertEventStatus(
      event.status,
      [EventStatus.IN_PROGRESS],
      'Событие в текущем статусе нельзя завершить.',
    );
    await this.assertEventChecklistsCompleted(tx, id);

    const oldAuditSnapshot = await getEventAuditSnapshot(tx, id);
    const nextFactDate =
      data.factDate ?? event.factDate ?? getBusinessTodayDate();
    await this.repository.updateStatus(tx, {
      conflictCode: 'EVENT_VERSION_CONFLICT',
      data: {
        factDate: nextFactDate,
      },
      eventId: id,
      expectedStatus: EventStatus.IN_PROGRESS,
      expectedVersion: data.version,
      status: EventStatus.COMPLETED,
      conflictMessage: 'Событие в текущем статусе нельзя завершить.',
    });

    const auditSnapshot = await getEventAuditSnapshot(tx, id);
    await writeEventStatusAudit(tx, {
      event: auditSnapshot,
      newStatus: EventStatus.COMPLETED,
      oldStatus: event.status,
      userId: actorUserId,
    });

    if (
      oldAuditSnapshot.factDate?.toISOString() !==
      auditSnapshot.factDate?.toISOString()
    ) {
      await writeEventUpdatedAudit(tx, {
        newEvent: auditSnapshot,
        oldEvent: oldAuditSnapshot,
        userId: actorUserId,
      });
    }

    return { eventId: id };
  }

  cancel(
    id: number,
    data: CancelEventData,
    userId?: string | null,
  ): Promise<EventLifecycleResult> {
    return this.prisma.$transaction((tx) =>
      this.cancelInTransaction(tx, id, data, userId),
    );
  }

  async cancelInTransaction(
    tx: Prisma.TransactionClient,
    id: number,
    data: InternalEventLifecycleData,
    userId?: string | null,
    options?: EventLifecycleScopeOptions,
  ): Promise<EventLifecycleResult> {
    const actorUserId = requireLifecycleUserId(userId);
    const event = await this.repository.loadForUpdate(tx, id);

    await options?.assertScope?.(tx, id);
    assertEventVersionMatches(event.version, data.version);
    assertEventStatus(
      event.status,
      [EventStatus.CREATED, EventStatus.IN_PROGRESS],
      'Событие в текущем статусе нельзя отменить.',
    );
    const activeChecklists = await this.repository.lockActiveChecklists(tx, id);

    await this.repository.updateStatus(tx, {
      conflictCode:
        data.version === undefined
          ? 'EVENT_STATUS_CONFLICT'
          : 'EVENT_VERSION_CONFLICT',
      eventId: id,
      expectedStatus: event.status,
      expectedVersion: data.version,
      status: EventStatus.CANCELLED,
      conflictMessage: 'Событие в текущем статусе нельзя отменить.',
    });
    await this.checklistEventCompletionService.cancelActiveChecklistsForCancelledEvent(
      tx,
      activeChecklists,
      actorUserId,
    );
    await this.writeStatusAudit(tx, {
      eventId: id,
      newStatus: EventStatus.CANCELLED,
      oldStatus: event.status,
      userId: actorUserId,
    });

    return { eventId: id };
  }

  private async assertEventChecklistsCompleted(
    tx: Prisma.TransactionClient,
    eventId: number,
  ): Promise<void> {
    if (await this.repository.hasIncompleteChecklists(tx, eventId)) {
      throwEventConflict(
        'EVENT_CHECKLISTS_INCOMPLETE',
        'Нельзя завершить событие, пока не завершены все чек-листы.',
      );
    }
  }

  private async writeStatusAudit(
    tx: Prisma.TransactionClient,
    params: {
      eventId: number;
      newStatus: EventStatus;
      oldStatus: EventStatus;
      userId: string;
    },
  ): Promise<void> {
    const auditSnapshot = await getEventAuditSnapshot(tx, params.eventId);
    await writeEventStatusAudit(tx, {
      event: auditSnapshot,
      newStatus: params.newStatus,
      oldStatus: params.oldStatus,
      userId: params.userId,
    });
  }
}
