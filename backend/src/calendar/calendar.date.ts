import { MS_PER_DAY } from './calendar.constants';

export const CALENDAR_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function daysBetween(dateFrom: Date, dateTo: Date): number {
  return Math.floor((dateTo.getTime() - dateFrom.getTime()) / MS_PER_DAY);
}

export function formatCalendarDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}
