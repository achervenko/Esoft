import { Injectable } from '@nestjs/common';
import { ChecklistStatus, EquipmentEventStatus, Prisma } from '@prisma/client';
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
    await this.lockEventForUpdate(tx, eventId);

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
    await this.checklistAssertions.assertAllChecklistsCompleted(
      tx,
      eventId,
    );

    return event;
  }

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

  async assertEventCanBeStarted(
    tx: Prisma.TransactionClient,
    eventId: number,
    userId?: string | null,
  ) {
    await this.lockEventForUpdate(tx, eventId);

    const event = await tx.equipmentEvent.findUnique({
      where: { id: eventId },
      select: {
        checklists: {
          select: {
            assignedUserId: true,
            status: true,
          },
        },
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

    this.assertChecklistsMatchResponsibles(event);
    this.assertChecklistsAreCreated(event.checklists);
    this.accessAssertions.assertAssignedResponsible(event.responsibles, userId);

    return event;
  }

  private assertChecklistsMatchResponsibles(event: {
    checklists: Array<{ assignedUserId: string; status: ChecklistStatus }>;
    responsibles: Array<{ userId: string }>;
  }) {
    if (event.responsibles.length === 0) {
      throwEquipmentEventBadRequest(
        'RESPONSIBLES_REQUIRED',
        'У события должен быть хотя бы один ответственный.',
      );
    }

    const responsibleUserIdSet = new Set(
      event.responsibles.map((responsible) => responsible.userId),
    );
    const checklistAssignedUserIds = event.checklists.map(
      (checklist) => checklist.assignedUserId,
    );
    const checklistAssignedUserIdSet = new Set(checklistAssignedUserIds);

    if (
      checklistAssignedUserIds.length !== responsibleUserIdSet.size ||
      checklistAssignedUserIdSet.size !== responsibleUserIdSet.size
    ) {
      throwEquipmentEventConflict(
        'CHECKLIST_ASSIGNMENTS_REQUIRED',
        'У каждого ответственного должен быть ровно один чек-лист.',
      );
    }

    for (const responsibleUserId of responsibleUserIdSet) {
      if (!checklistAssignedUserIdSet.has(responsibleUserId)) {
        throwEquipmentEventConflict(
          'CHECKLIST_ASSIGNMENTS_REQUIRED',
          'Назначения чек-листов должны полностью соответствовать ответственным события.',
        );
      }
    }
  }

  private assertChecklistsAreCreated(
    checklists: Array<{ status: ChecklistStatus }>,
  ) {
    if (checklists.some((checklist) => checklist.status !== 'CREATED')) {
      throwEquipmentEventConflict(
        'CHECKLIST_STATUS_CONFLICT',
        'Перед стартом все чек-листы события должны быть в статусе CREATED.',
      );
    }
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
