import { EventExtensionCode, Prisma } from '@prisma/client';
import { Injectable } from '@nestjs/common';
import { daysBetween } from '../calendar.date';
import { throwCalendarConflict } from '../calendar.errors';
import { EventsQueryService } from '../../events/events-query.service';
import type { EventListResponse } from '../../events/events.presenter';
import {
  CalendarItemSource,
  CalendarLayerCode,
  type CalendarLayerItemDto,
  type CalendarPeriod,
  type CalendarProvider,
  type CalendarProviderResult,
} from './calendar-engine.types';

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
          code: CalendarLayerCode.EVENTS,
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

  return {
    details: event.extension,
    displayDate,
    factDate: event.factDate,
    id: String(event.id),
    isOverdue: overdue.isOverdue,
    overdueDays: overdue.overdueDays,
    plannedDate: event.plannedDate,
    source: CalendarItemSource.EQUIPMENT,
    status: event.status,
    title: event.title,
  };
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
