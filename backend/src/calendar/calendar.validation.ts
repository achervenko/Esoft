import {
  CALENDAR_END_DATE,
  CALENDAR_RANGE_LIMIT_DAYS,
  CALENDAR_START_DATE,
} from './calendar.constants';
import {
  CALENDAR_DATE_PATTERN,
  daysBetween,
  formatCalendarDate,
} from './calendar.date';
import { throwCalendarBadRequest } from './calendar.errors';
import { isWorkingHoursValidForWorkday } from './calendar.workday-rules';
import type { CalendarDayQueryDto } from './dto/calendar-day-query.dto';
import type { CalendarEngineQueryDto } from './dto/calendar-engine-query.dto';
import type { CalendarRangeQueryDto } from './dto/calendar-range-query.dto';
import type { CalendarWorkdayUpdateDto } from './dto/calendar-workday-update.dto';
import type { CalendarWorkdayUpdate } from './calendar.types';

export function parseCalendarDayQuery(
  query: CalendarDayQueryDto | undefined,
): Date {
  return parseRequiredCalendarDate(query?.date, 'DATE_REQUIRED');
}

export function parseCalendarRangeQuery(
  query: CalendarRangeQueryDto | undefined,
): { dateFrom: Date; dateTo: Date } {
  const dateFrom = parseRequiredCalendarDate(
    query?.dateFrom,
    'DATE_FROM_REQUIRED',
  );
  const dateTo = parseRequiredCalendarDate(query?.dateTo, 'DATE_TO_REQUIRED');

  validateCalendarRange(dateFrom, dateTo);

  return { dateFrom, dateTo };
}

export function parseCalendarEngineQuery(
  query: CalendarEngineQueryDto | undefined,
): { dateFrom: Date; dateTo: Date } {
  const dateFrom = parseRequiredCalendarDate(query?.from, 'DATE_FROM_REQUIRED');
  const dateTo = parseRequiredCalendarDate(query?.to, 'DATE_TO_REQUIRED');

  validateCalendarRange(dateFrom, dateTo);

  return { dateFrom, dateTo };
}

export function parseCalendarWorkdayUpdateDto(
  dto: CalendarWorkdayUpdateDto | undefined,
): CalendarWorkdayUpdate {
  const body = dto ?? {};
  const update: CalendarWorkdayUpdate = {
    date: parseRequiredCalendarDate(body.date, 'DATE_REQUIRED'),
  };

  if (body.isWorkingDay !== undefined) {
    update.isWorkingDay = parseBoolean(
      body.isWorkingDay,
      'IS_WORKING_DAY_INVALID',
      'Некорректный признак рабочего дня.',
    );
  }

  if (body.isHoliday !== undefined) {
    update.isHoliday = parseBoolean(
      body.isHoliday,
      'IS_HOLIDAY_INVALID',
      'Некорректный признак праздника.',
    );
  }

  if (body.isPreholiday !== undefined) {
    update.isPreholiday = parseBoolean(
      body.isPreholiday,
      'IS_PREHOLIDAY_INVALID',
      'Некорректный признак предпраздничного дня.',
    );
  }

  if (body.holidayName !== undefined) {
    update.holidayName = parseNullableText(
      body.holidayName,
      'HOLIDAY_NAME_INVALID',
      'Некорректное название праздника.',
    );
  }

  if (body.workingHours !== undefined) {
    update.workingHours = parseWorkingHours(body.workingHours);
  }

  const hasWorkdayChange =
    update.holidayName !== undefined ||
    update.isHoliday !== undefined ||
    update.isPreholiday !== undefined ||
    update.isWorkingDay !== undefined ||
    update.workingHours !== undefined;

  if (!hasWorkdayChange) {
    throwCalendarBadRequest(
      'WORKDAY_CHANGE_REQUIRED',
      'Укажите изменения производственного календаря.',
    );
  }

  validateWorkingDayHours(update);

  return update;
}

function parseRequiredCalendarDate(value: unknown, requiredCode: string): Date {
  if (value === undefined || value === null || value === '') {
    throwCalendarBadRequest(requiredCode, 'Укажите дату.');
  }

  if (typeof value !== 'string' || !CALENDAR_DATE_PATTERN.test(value)) {
    throwCalendarBadRequest('DATE_INVALID', 'Некорректная дата.');
  }

  if (value < CALENDAR_START_DATE || value > CALENDAR_END_DATE) {
    throwCalendarBadRequest(
      'DATE_OUT_OF_RANGE',
      `Дата должна быть в диапазоне ${CALENDAR_START_DATE} - ${CALENDAR_END_DATE}.`,
    );
  }

  const date = new Date(`${value}T00:00:00.000Z`);

  if (Number.isNaN(date.getTime()) || formatCalendarDate(date) !== value) {
    throwCalendarBadRequest('DATE_INVALID', 'Некорректная дата.');
  }

  return date;
}

function validateCalendarRange(dateFrom: Date, dateTo: Date): void {
  if (dateFrom > dateTo) {
    throwCalendarBadRequest(
      'DATE_RANGE_INVALID',
      'Дата начала периода не может быть позже даты окончания.',
    );
  }

  if (daysBetween(dateFrom, dateTo) + 1 > CALENDAR_RANGE_LIMIT_DAYS) {
    throwCalendarBadRequest(
      'DATE_RANGE_TOO_LONG',
      `Диапазон календаря не должен превышать ${CALENDAR_RANGE_LIMIT_DAYS} дней.`,
    );
  }
}

function parseBoolean(value: unknown, code: string, message: string): boolean {
  if (typeof value !== 'boolean') {
    throwCalendarBadRequest(code, message);
  }

  return value;
}

function parseNullableText(
  value: unknown,
  code: string,
  message: string,
): string | null {
  if (value === null) {
    return null;
  }

  if (typeof value !== 'string') {
    throwCalendarBadRequest(code, message);
  }

  const trimmedValue = value.trim();

  return trimmedValue || null;
}

function parseWorkingHours(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throwCalendarBadRequest(
      'WORKING_HOURS_INVALID',
      'Некорректная продолжительность рабочего дня.',
    );
  }

  if (value < 0 || value > 24 || Math.round(value * 100) !== value * 100) {
    throwCalendarBadRequest(
      'WORKING_HOURS_INVALID',
      'Некорректная продолжительность рабочего дня.',
    );
  }

  return value;
}

function validateWorkingDayHours(update: CalendarWorkdayUpdate) {
  if (update.isWorkingDay === undefined || update.workingHours === undefined) {
    return;
  }

  if (isWorkingHoursValidForWorkday(update.isWorkingDay, update.workingHours)) {
    return;
  }

  throwCalendarBadRequest(
    'WORKING_HOURS_INVALID',
    update.isWorkingDay
      ? 'Для рабочего дня укажите положительную продолжительность.'
      : 'Для нерабочего дня продолжительность должна быть 0.',
  );
}
