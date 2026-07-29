import type { CalendarDayRecordWithWorkday } from './calendar.select';
import { formatCalendarDate } from './calendar.date';
import type { CalendarDayResponse } from './calendar.types';

export type CalendarPresentedDay = CalendarDayResponse;

export function toCalendarDayResponse(
  record: CalendarDayRecordWithWorkday,
): CalendarPresentedDay {
  return {
    date: formatCalendarDate(record.date),
    day: record.day,
    dayOfWeek: record.dayOfWeek,
    dayOfYear: record.dayOfYear,
    holidayName: record.workday.holidayName,
    isHoliday: record.workday.isHoliday,
    isPreholiday: record.workday.isPreholiday,
    isWorkingDay: record.workday.isWorkingDay,
    isoWeekYear: record.isoWeekYear,
    month: record.month,
    quarter: record.quarter,
    source: record.workday.source,
    week: record.week,
    workingHours: Number(record.workday.workingHours),
    year: record.year,
  };
}
