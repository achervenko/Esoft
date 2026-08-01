import { EventExtensionCode, Prisma } from '@prisma/client';
import { Injectable } from '@nestjs/common';
import { daysBetween } from '../calendar.date';
import { throwCalendarConflict } from '../calendar.errors';
import { EventsQueryService } from '../../events/events-query.service';
import type { EventListResponse } from '../../events/events.presenter';
import type { EquipmentEventExtensionListResponse } from '../../equipment-event-extension/equipment-event-extension.presenter.types';
import {
  type CalendarLayerItemDto,
  type CalendarPeriod,
  type CalendarProvider,
  type CalendarProviderResult,
} from './calendar-engine.types';

export const EQUIPMENT_EVENTS_CALENDAR_LAYER_CODE = 'EVENTS';
export const EQUIPMENT_CALENDAR_ITEM_SOURCE = 'EQUIPMENT';

@Injectable()
export class EquipmentEventsProvider implements CalendarProvider {
  constructor(private readonly eventsQueryService: EventsQueryService) {}

  async getCalendarData(
    period: CalendarPeriod,
  ): Promise<CalendarProviderResult> {
    const events = await this.eventsQueryService.findAll({
      orderBy: [
        { factDate: { sort: 'asc', nulls: 'last' } },
        { plannedDate: 'asc' },
        { id: 'asc' },
      ],
      where: buildDisplayDateWhere(period),
    });

    return {
      layers: [
        {
          code: EQUIPMENT_EVENTS_CALENDAR_LAYER_CODE,
          items: events.map((event) =>
            toCalendarEventItem(event, period.today),
          ),
          title: 'События',
        },
      ],
    };
  }
}

function buildDisplayDateWhere(period: CalendarPeriod): Prisma.EventWhereInput {
  return {
    extensionCode: EventExtensionCode.EQUIPMENT,
    OR: [
      {
        factDate: {
          gte: period.dateFrom,
          lte: period.dateTo,
        },
      },
      {
        factDate: null,
        plannedDate: {
          gte: period.dateFrom,
          lte: period.dateTo,
        },
      },
    ],
  };
}

function toCalendarEventItem(
  event: EventListResponse,
  today: Date,
): CalendarLayerItemDto {
  const displayDate = event.factDate ?? event.plannedDate;

  if (!displayDate) {
    throwCalendarConflict(
      'CALENDAR_EVENT_DATE_MISSING',
      'Событие не содержит дату отображения.',
    );
  }

  const overdue = calculateOverdue(event, today);
  const extension = castEquipmentExtension(event.extension);

  return {
    badge: extension.maintenanceType.name,
    details: extension,
    displayDate,
    factDate: event.factDate,
    icon: 'tool',
    id: String(event.id),
    isOverdue: overdue.isOverdue,
    navigation: {
      params: {
        equipmentVisibleId: extension.equipment.visibleId,
        eventId: event.id,
      },
      type: 'equipment-event',
    },
    overdueDays: overdue.overdueDays,
    plannedDate: event.plannedDate,
    source: EQUIPMENT_CALENDAR_ITEM_SOURCE,
    status: event.status,
    subtitle: formatCalendarEventSubtitle(extension.equipment),
    title: formatCalendarEventTitle(extension.equipment),
  };
}

function formatCalendarEventTitle(
  equipment: EquipmentEventExtensionListResponse['equipment'],
) {
  return `${equipment.name} ID ${equipment.visibleId}`;
}

function formatCalendarEventSubtitle(
  equipment: EquipmentEventExtensionListResponse['equipment'],
) {
  return [
    equipment.location,
    equipment.serialNumber ? `Зав. № ${equipment.serialNumber}` : null,
  ]
    .filter(Boolean)
    .join(' · ');
}

function castEquipmentExtension(
  extension: EventListResponse['extension'],
): EquipmentEventExtensionListResponse {
  return extension as EquipmentEventExtensionListResponse;
}

function calculateOverdue(
  event: EventListResponse,
  today: Date,
): { isOverdue: boolean; overdueDays: number } {
  if (event.factDate !== null || !event.plannedDate) {
    return { isOverdue: false, overdueDays: 0 };
  }

  const plannedDate = new Date(`${event.plannedDate}T00:00:00.000Z`);

  if (plannedDate >= today) {
    return { isOverdue: false, overdueDays: 0 };
  }

  return {
    isOverdue: true,
    overdueDays: daysBetween(plannedDate, today),
  };
}
