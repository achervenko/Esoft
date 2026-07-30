import { CalendarSource } from '@prisma/client';
import { Injectable } from '@nestjs/common';
import { CalendarService } from '../calendar.service';
import type { CalendarDayResponse } from '../calendar.types';
import {
  CalendarDayType,
  type CalendarDayDto,
  type CalendarPeriod,
  type CalendarProvider,
  type CalendarProviderResult,
} from './calendar-engine.types';

@Injectable()
export class ProductionCalendarProvider implements CalendarProvider {
  constructor(private readonly calendarService: CalendarService) {}

  async getCalendarData(
    period: CalendarPeriod,
  ): Promise<CalendarProviderResult> {
    const range = await this.calendarService.getRange(
      period.dateFrom,
      period.dateTo,
    );

    return {
      days: range.days.map(toCalendarEngineDay),
    };
  }
}

function toCalendarEngineDay(day: CalendarDayResponse): CalendarDayDto {
  return {
    comment: day.holidayName,
    date: day.date,
    isManual: day.source !== CalendarSource.SYSTEM,
    type: resolveCalendarDayType(day),
  };
}

function resolveCalendarDayType(day: CalendarDayResponse): CalendarDayType {
  if (day.isHoliday) {
    return CalendarDayType.HOLIDAY;
  }

  if (day.isPreholiday) {
    return CalendarDayType.SHORTENED;
  }

  if (day.isWorkingDay) {
    return CalendarDayType.WORKING;
  }

  return CalendarDayType.WEEKEND;
}
