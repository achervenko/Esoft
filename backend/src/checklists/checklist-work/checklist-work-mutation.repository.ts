import { Injectable } from '@nestjs/common';
import { ChecklistStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { throwChecklistNotFound } from '../checklist-common/checklists.errors';
import { checklistProgressSelectFields } from './checklist-work-progress.sql';
import type {
  ChecklistDetailAnswerRow,
  LockedChecklist,
  LockedChecklistEvent,
  LockedEventChecklistRow,
} from './checklist-work.repository.types';

@Injectable()
export class ChecklistWorkMutationRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findChecklistEventId(checklistId: number) {
    const [row] = await this.prisma.$queryRaw<Array<{ eventId: number }>>`
      SELECT equipment_event_id AS "eventId"
      FROM checklists
      WHERE id = ${checklistId}
    `;

    return row?.eventId ?? null;
  }

  async lockChecklistForMutation(
    tx: Prisma.TransactionClient,
    checklistId: number,
  ): Promise<{ checklist: LockedChecklist; event: LockedChecklistEvent }> {
    const eventId = await this.findChecklistEventIdInTransaction(
      tx,
      checklistId,
    );

    if (eventId === null) {
      throwChecklistNotFound('CHECKLIST_NOT_FOUND', 'Чек-лист не найден.');
    }

    const event = await this.lockEvent(tx, eventId);
    const checklist = await this.lockChecklist(tx, checklistId);

    if (checklist.equipmentEventId !== event.eventId) {
      throwChecklistMissingAfterLock();
    }

    return { checklist, event };
  }

  lockEvent(tx: Prisma.TransactionClient, eventId: number) {
    return tx.$queryRaw<LockedChecklistEvent[]>`
      SELECT
        id AS "eventId",
        status AS "eventStatus",
        fact_date AS "factDate"
      FROM equipment_events
      WHERE id = ${eventId}
      FOR UPDATE
    `.then((rows) => {
      const event = rows[0];

      if (!event) {
        throwChecklistNotFound('EVENT_NOT_FOUND', 'Событие не найдено.');
      }

      return event;
    });
  }

  lockEventChecklists(
    tx: Prisma.TransactionClient,
    eventId: number,
  ): Promise<LockedEventChecklistRow[]> {
    return tx.$queryRaw<LockedEventChecklistRow[]>`
      SELECT
        id,
        assigned_user_id AS "assignedUserId",
        status
      FROM checklists
      WHERE equipment_event_id = ${eventId}
      ORDER BY id
      FOR UPDATE
    `;
  }

  async loadResponsibleUserIds(
    tx: Prisma.TransactionClient,
    eventId: number,
  ) {
    const rows = await tx.$queryRaw<Array<{ userId: string }>>`
      SELECT user_id AS "userId"
      FROM equipment_event_responsibles
      WHERE equipment_event_id = ${eventId}
      ORDER BY user_id
    `;

    return rows.map((row) => row.userId);
  }

  async lockActiveEventChecklists(
    tx: Prisma.TransactionClient,
    eventId: number,
  ) {
    return tx.$queryRaw<
      Array<{
        id: number;
        status: ChecklistStatus;
      }>
    >`
      SELECT id, status
      FROM checklists
      WHERE equipment_event_id = ${eventId}
        AND status IN ('CREATED', 'IN_PROGRESS')
      ORDER BY id
      FOR UPDATE
    `;
  }

  async loadAnswerRows(
    tx: Prisma.TransactionClient,
    checklistId: number,
    checklistDetailIds: number[],
  ) {
    if (checklistDetailIds.length === 0) {
      return [];
    }

    return tx.$queryRaw<ChecklistDetailAnswerRow[]>`
      SELECT
        id AS "checklistDetailId",
        checklist_id AS "checklistId",
        answer_type AS "answerType",
        is_required AS "isRequired",
        answer_boolean AS "answerBoolean",
        answer_integer AS "answerInteger",
        answer_decimal AS "answerDecimal",
        answer_text AS "answerText",
        answer_date AS "answerDate"
      FROM checklist_details
      WHERE checklist_id = ${checklistId}
        AND id IN (${Prisma.join(checklistDetailIds)})
      ORDER BY id
    `;
  }

  progress(tx: Prisma.TransactionClient, checklistId: number) {
    return tx.$queryRaw<
      Array<{
        answered: bigint;
        requiredAnswered: bigint;
        requiredTotal: bigint;
        total: bigint;
      }>
    >`
      SELECT
        ${checklistProgressSelectFields()}
      FROM checklist_details detail
      WHERE detail.checklist_id = ${checklistId}
    `.then((rows) => rows[0]);
  }

  private async findChecklistEventIdInTransaction(
    tx: Prisma.TransactionClient,
    checklistId: number,
  ) {
    const [row] = await tx.$queryRaw<Array<{ eventId: number }>>`
      SELECT equipment_event_id AS "eventId"
      FROM checklists
      WHERE id = ${checklistId}
    `;

    return row?.eventId ?? null;
  }

  private lockChecklist(tx: Prisma.TransactionClient, checklistId: number) {
    return tx.$queryRaw<LockedChecklist[]>`
      SELECT
        id,
        equipment_event_id AS "equipmentEventId",
        assigned_user_id AS "assignedUserId",
        status,
        version
      FROM checklists
      WHERE id = ${checklistId}
      FOR UPDATE
    `.then((rows) => {
      const checklist = rows[0];

      if (!checklist) {
        throwChecklistNotFound('CHECKLIST_NOT_FOUND', 'Чек-лист не найден.');
      }

      return checklist;
    });
  }
}

function throwChecklistMissingAfterLock(): never {
  throwChecklistNotFound('CHECKLIST_NOT_FOUND', 'Чек-лист не найден.');
}
