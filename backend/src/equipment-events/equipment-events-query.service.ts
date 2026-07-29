import { Injectable } from '@nestjs/common';
import { EventExtensionCode, Prisma } from '@prisma/client';
import { EventsQueryService } from '../events/events-query.service';
import type {
  EventDetailRecord,
  EventListRecord,
} from '../events/events.relations';
import { throwEquipmentEventNotFound } from './equipment-events.errors';
import {
  toEquipmentEventDetailResponse,
  toEquipmentEventListResponse,
} from './equipment-events.presenter';
import type {
  EquipmentEventDetailRecordWithExtension,
  EquipmentEventListRecordWithExtension,
} from './equipment-events.relations';
import { type EquipmentEventsQuery } from './equipment-events.validation';

@Injectable()
export class EquipmentEventsQueryService {
  constructor(private readonly eventsQueryService: EventsQueryService) {}

  async findAll(query: EquipmentEventsQuery) {
    const equipmentExtensionWhere: Prisma.EquipmentEventExtensionWhereInput = {
      ...(query.equipmentVisibleId
        ? { equipment: { visibleId: query.equipmentVisibleId } }
        : {}),
      ...(query.maintenanceTypeId
        ? { eventTypeId: query.maintenanceTypeId }
        : {}),
    };
    const where: Prisma.EventWhereInput = {
      extensionCode: EventExtensionCode.EQUIPMENT,
      equipmentExtension: {
        is: equipmentExtensionWhere,
      },
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
            plannedDate: {
              ...(query.dateFrom ? { gte: query.dateFrom } : {}),
              ...(query.dateTo ? { lte: query.dateTo } : {}),
            },
          }
        : {}),
    };

    const { checklistsByEventId, events } =
      await this.eventsQueryService.findListRecords({
        where,
        orderBy: [
          { factDate: { sort: 'desc', nulls: 'last' } },
          { plannedDate: 'desc' },
          { createdAt: 'desc' },
          { id: 'desc' },
        ],
        offset: query.offset,
        limit: query.limit,
      });

    return events.map((event) => {
      assertEquipmentEventRecord(event);

      return toEquipmentEventListResponse(
        event,
        checklistsByEventId.get(event.id),
      );
    });
  }

  async findOne(id: number) {
    const record = await this.eventsQueryService.findDetailRecord({
      id,
      extensionCode: EventExtensionCode.EQUIPMENT,
      equipmentExtension: {
        is: {},
      },
    });

    if (!record) {
      throwEquipmentEventNotFound(
        'EVENT_NOT_FOUND',
        'Событие оборудования не найдено.',
      );
    }

    assertEquipmentEventDetailRecord(record.event);

    return toEquipmentEventDetailResponse(
      record.event,
      record.checklistsByEventId.get(record.event.id),
    );
  }

  async findResponsibleUsers() {
    return this.eventsQueryService.findResponsibleUsers();
  }
}

function assertEquipmentEventRecord(
  event: EventListRecord,
): asserts event is EquipmentEventListRecordWithExtension {
  if (
    event.extensionCode !== EventExtensionCode.EQUIPMENT ||
    !event.equipmentExtension
  ) {
    throwEquipmentEventNotFound(
      'EVENT_NOT_FOUND',
      'Событие оборудования не найдено.',
    );
  }
}

function assertEquipmentEventDetailRecord(
  event: EventDetailRecord,
): asserts event is EquipmentEventDetailRecordWithExtension {
  if (
    event.extensionCode !== EventExtensionCode.EQUIPMENT ||
    !event.equipmentExtension
  ) {
    throwEquipmentEventNotFound(
      'EVENT_NOT_FOUND',
      'Событие оборудования не найдено.',
    );
  }
}
