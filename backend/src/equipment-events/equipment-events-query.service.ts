import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { checklistProgressGroupedByChecklistSql } from '../checklists/checklist-work/checklist-work-progress.sql';
import { PrismaService } from '../prisma/prisma.service';
import { throwEquipmentEventNotFound } from './equipment-events.errors';
import {
  toEquipmentEventDetailResponse,
  toEquipmentEventListResponse,
} from './equipment-events.presenter';
import {
  type EquipmentEventChecklistRecord,
  equipmentEventDetailSelect,
  equipmentEventListSelect,
} from './equipment-events.relations';
import { type EquipmentEventsQuery } from './equipment-events.validation';

@Injectable()
export class EquipmentEventsQueryService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: EquipmentEventsQuery) {
    const where: Prisma.EquipmentEventWhereInput = {
      ...(query.equipmentVisibleId
        ? { equipment: { visibleId: query.equipmentVisibleId } }
        : {}),
      ...(query.maintenanceTypeId
        ? { eventTypeId: query.maintenanceTypeId }
        : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.responsibleUserId
        ? {
            responsibles: {
              some: {
                userId: query.responsibleUserId,
              },
            },
          }
        : {}),
      ...(query.dateFrom || query.dateTo
        ? {
            factDate: {
              ...(query.dateFrom ? { gte: query.dateFrom } : {}),
              ...(query.dateTo ? { lte: query.dateTo } : {}),
            },
          }
        : {}),
    };

    const events = await this.prisma.equipmentEvent.findMany({
      where,
      select: equipmentEventListSelect,
      orderBy: [
        { factDate: { sort: 'desc', nulls: 'last' } },
        { plannedDate: { sort: 'desc', nulls: 'last' } },
        { createdAt: 'desc' },
        { id: 'desc' },
      ],
      skip: query.offset,
      take: query.limit,
    });

    const checklistsByEventId = await this.loadChecklistsByEventId(
      events.map((event) => event.id),
    );

    return events.map((event) =>
      toEquipmentEventListResponse(event, checklistsByEventId.get(event.id)),
    );
  }

  async findOne(id: number) {
    const event = await this.prisma.equipmentEvent.findUnique({
      where: { id },
      select: equipmentEventDetailSelect,
    });

    if (!event) {
      throwEquipmentEventNotFound(
        'EVENT_NOT_FOUND',
        'Событие оборудования не найдено.',
      );
    }

    const checklistsByEventId = await this.loadChecklistsByEventId([event.id]);

    return toEquipmentEventDetailResponse(
      event,
      checklistsByEventId.get(event.id),
    );
  }

  async findResponsibleUsers() {
    const users = await this.prisma.user.findMany({
      orderBy: [
        { employeeUser: { employee: { lastName: 'asc' } } },
        { employeeUser: { employee: { firstName: 'asc' } } },
        { name: 'asc' },
      ],
      select: {
        employeeUser: {
          select: {
            employee: {
              select: {
                firstName: true,
                lastName: true,
                middleName: true,
                position: true,
              },
            },
          },
        },
        id: true,
        role: true,
      },
      where: {
        employeeUser: {
          isNot: null,
        },
        OR: [{ banned: false }, { banned: null }],
      },
    });

    return {
      users: users.flatMap((user) => {
        const employee = user.employeeUser?.employee;

        if (!employee) {
          return [];
        }

        return [
          {
            fullName: [
              employee.lastName,
              employee.firstName,
              employee.middleName,
            ]
              .filter(Boolean)
              .join(' '),
            position: employee.position,
            role: user.role,
            userId: user.id,
          },
        ];
      }),
    };
  }


  private async loadChecklistsByEventId(eventIds: number[]) {
    const checklistsByEventId = new Map<
      number,
      EquipmentEventChecklistRecord[]
    >();

    if (eventIds.length === 0) {
      return checklistsByEventId;
    }

    const checklists = await this.prisma.$queryRaw<
      Array<
        EquipmentEventChecklistRecord & {
          equipmentEventId: number;
        }
      >
    >`
      WITH checklist_progress AS (
        ${checklistProgressGroupedByChecklistSql()}
      )
      SELECT
        checklist.id,
        checklist.equipment_event_id AS "equipmentEventId",
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
      WHERE checklist.equipment_event_id IN (${Prisma.join(eventIds)})
      ORDER BY checklist.equipment_event_id, checklist.sort_order, checklist.id
    `;

    for (const checklist of checklists) {
      const eventChecklists =
        checklistsByEventId.get(checklist.equipmentEventId) ?? [];

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
      checklistsByEventId.set(checklist.equipmentEventId, eventChecklists);
    }

    return checklistsByEventId;
  }
}
