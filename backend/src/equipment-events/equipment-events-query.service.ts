import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { throwEquipmentEventNotFound } from './equipment-events.errors';
import {
  toEquipmentEventDetailResponse,
  toEquipmentEventListResponse,
} from './equipment-events.presenter';
import {
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

    return events.map(toEquipmentEventListResponse);
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

    return toEquipmentEventDetailResponse(event);
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
}
