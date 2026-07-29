import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { checklistProgressGroupedByChecklistSql } from '../checklists/checklist-work/checklist-work-progress.sql';
import { PrismaService } from '../prisma/prisma.service';
import { throwEventNotFound } from './events.errors';
import { toEventDetailResponse, toEventListResponse } from './events.presenter';
import {
  type EventChecklistRecord,
  eventDetailSelect,
  eventListSelect,
} from './events.relations';

export type EventsListRecordsQuery = {
  limit?: number;
  offset?: number;
  orderBy?: Prisma.EventOrderByWithRelationInput[];
  where?: Prisma.EventWhereInput;
};

@Injectable()
export class EventsQueryService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: EventsListRecordsQuery = {}) {
    const { checklistsByEventId, events } = await this.findListRecords(query);

    return events.map((event) =>
      toEventListResponse(event, checklistsByEventId.get(event.id)),
    );
  }

  async findOne(id: number) {
    const record = await this.findDetailRecord({ id });

    if (!record) {
      throwEventNotFound('EVENT_NOT_FOUND', 'Событие не найдено.');
    }

    return toEventDetailResponse(
      record.event,
      record.checklistsByEventId.get(record.event.id),
    );
  }

  async findListRecords(query: EventsListRecordsQuery = {}) {
    const events = await this.prisma.event.findMany({
      where: query.where,
      select: eventListSelect,
      orderBy: query.orderBy ?? defaultEventOrderBy(),
      skip: query.offset,
      take: query.limit,
    });

    const checklistsByEventId = await this.loadChecklistsByEventId(
      events.map((event) => event.id),
    );

    return { checklistsByEventId, events };
  }

  async findDetailRecord(where: Prisma.EventWhereInput) {
    const event = await this.prisma.event.findFirst({
      where,
      select: eventDetailSelect,
    });

    if (!event) {
      return null;
    }

    return {
      checklistsByEventId: await this.loadChecklistsByEventId([event.id]),
      event,
    };
  }

  private async loadChecklistsByEventId(eventIds: number[]) {
    const checklistsByEventId = new Map<number, EventChecklistRecord[]>();

    if (eventIds.length === 0) {
      return checklistsByEventId;
    }

    const checklists = await this.prisma.$queryRaw<
      Array<
        EventChecklistRecord & {
          eventId: number;
        }
      >
    >`
      WITH checklist_progress AS (
        ${checklistProgressGroupedByChecklistSql()}
      )
      SELECT
        checklist.id,
        checklist.event_id AS "eventId",
        checklist.checklist_template_id AS "checklistTemplateId",
        checklist.assigned_user_id AS "assignedUserId",
        checklist.status,
        checklist.sort_order AS "sortOrder",
        template.name AS "templateName",
        json_build_object(
          'id',
          assigned_user.id,
          'fullName',
          COALESCE(
            NULLIF(
              TRIM(
                CONCAT_WS(
                  ' ',
                  assigned_employee.last_name,
                  assigned_employee.first_name,
                  assigned_employee.middle_name
                )
              ),
              ''
            ),
            assigned_user.name
          ),
          'position',
          COALESCE(assigned_employee.position, '')
        ) AS "assignedUser",
        json_build_object(
          'answered',
          COALESCE(progress.answered, 0)::int,
          'total',
          COALESCE(progress.total, 0)::int,
          'requiredAnswered',
          COALESCE(progress."requiredAnswered", 0)::int,
          'requiredTotal',
          COALESCE(progress."requiredTotal", 0)::int
        ) AS progress
      FROM checklists checklist
      JOIN checklist_templates template
        ON template.id = checklist.checklist_template_id
      JOIN "user" assigned_user
        ON assigned_user.id = checklist.assigned_user_id
      LEFT JOIN employee_users assigned_employee_user
        ON assigned_employee_user.user_id = assigned_user.id
      LEFT JOIN employees assigned_employee
        ON assigned_employee.id = assigned_employee_user.employee_id
      LEFT JOIN checklist_progress progress
        ON progress.checklist_id = checklist.id
      WHERE checklist.event_id IN (${Prisma.join(eventIds)})
      ORDER BY checklist.event_id, checklist.sort_order, checklist.id
    `;

    for (const checklist of checklists) {
      const eventChecklists = checklistsByEventId.get(checklist.eventId) ?? [];

      eventChecklists.push({
        assignedUser: checklist.assignedUser,
        assignedUserId: checklist.assignedUserId,
        checklistTemplateId: checklist.checklistTemplateId,
        id: checklist.id,
        progress: checklist.progress,
        sortOrder: checklist.sortOrder,
        status: checklist.status,
        templateName: checklist.templateName,
      });
      checklistsByEventId.set(checklist.eventId, eventChecklists);
    }

    return checklistsByEventId;
  }
}

function defaultEventOrderBy(): Prisma.EventOrderByWithRelationInput[] {
  return [
    { factDate: { sort: 'desc', nulls: 'last' } },
    { plannedDate: 'desc' },
    { createdAt: 'desc' },
    { id: 'desc' },
  ];
}
