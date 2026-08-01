import type { CalendarDto, CalendarLayerItemDto } from "../../../shared/api/calendar";
import {
  CALENDAR_MONTH_NAMES,
  CALENDAR_ZOOM_LEVELS,
  SUPPORTED_CALENDAR_VIEW_MODES,
} from "./calendar-page.constants";
import type {
  CalendarPeriodModel,
  CalendarPeriodCell,
  CalendarViewMode,
  CalendarZoomDirection,
} from "./calendar-page.types";

const FIRST_WEEKDAY = 1;
const LAST_WEEKDAY = 7;

export function createMonthDate(year: number, month: number): Date {
  return new Date(year, month, 1);
}

export function getNextMonth(value: Date): Date {
  return new Date(value.getFullYear(), value.getMonth() + 1, 1);
}

export function getPreviousMonth(value: Date): Date {
  return new Date(value.getFullYear(), value.getMonth() - 1, 1);
}

export function getNextWeek(value: Date): Date {
  return addDays(value, 7);
}

export function getPreviousWeek(value: Date): Date {
  return addDays(value, -7);
}

export function formatDateId(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export function formatMonthTitle(value: Date): string {
  return `${CALENDAR_MONTH_NAMES[value.getMonth()]} ${value.getFullYear()}`;
}

export function createCalendarMonth(
  visibleMonth: Date,
  calendar: CalendarDto | null,
): CalendarPeriodModel {
  const year = visibleMonth.getFullYear();
  const month = visibleMonth.getMonth();
  const monthStart = new Date(year, month, 1);
  const monthEnd = new Date(year, month + 1, 0);
  const gridStart = startOfCalendarWeek(monthStart);
  const gridEnd = endOfCalendarWeek(monthEnd);

  return {
    cells: createCalendarCells({
      calendar,
      currentMonth: month,
      dateFrom: gridStart,
      dateTo: gridEnd,
    }),
    dateFrom: formatDateId(gridStart),
    dateTo: formatDateId(gridEnd),
    month,
    title: formatMonthTitle(visibleMonth),
    year,
  };
}

export function createCalendarWeek(
  visibleDate: Date,
  calendar: CalendarDto | null,
): CalendarPeriodModel {
  const weekStart = startOfCalendarWeek(visibleDate);
  const weekEnd = endOfCalendarWeek(visibleDate);
  const month = visibleDate.getMonth();

  return {
    cells: createCalendarCells({
      calendar,
      currentMonth: null,
      dateFrom: weekStart,
      dateTo: weekEnd,
    }),
    dateFrom: formatDateId(weekStart),
    dateTo: formatDateId(weekEnd),
    month,
    title: formatWeekTitle(weekStart, weekEnd),
    year: visibleDate.getFullYear(),
  };
}

export function getMonthRequestRange(value: Date): Pick<
  CalendarPeriodModel,
  "dateFrom" | "dateTo"
> {
  const monthStart = new Date(value.getFullYear(), value.getMonth(), 1);
  const monthEnd = new Date(value.getFullYear(), value.getMonth() + 1, 0);

  return {
    dateFrom: formatDateId(startOfCalendarWeek(monthStart)),
    dateTo: formatDateId(endOfCalendarWeek(monthEnd)),
  };
}

export function getWeekRequestRange(value: Date): Pick<
  CalendarPeriodModel,
  "dateFrom" | "dateTo"
> {
  return {
    dateFrom: formatDateId(startOfCalendarWeek(value)),
    dateTo: formatDateId(endOfCalendarWeek(value)),
  };
}

export function parseDateId(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);

  return new Date(year, month - 1, day);
}

export function isValidDateId(
  value: string | null | undefined,
): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  return formatDateId(parseDateId(value)) === value;
}

export function setMonthAndYear(
  value: Date,
  params: { month?: number; year?: number },
): Date {
  return new Date(
    params.year ?? value.getFullYear(),
    params.month ?? value.getMonth(),
    1,
  );
}

export function getCalendarZoomViewMode(
  currentMode: CalendarViewMode,
  direction: CalendarZoomDirection,
): CalendarViewMode {
  const step = direction === "in" ? 1 : -1;
  const currentLevelIndex = CALENDAR_ZOOM_LEVELS.indexOf(currentMode);

  for (
    let index = currentLevelIndex + step;
    index >= 0 && index < CALENDAR_ZOOM_LEVELS.length;
    index += step
  ) {
    const level = CALENDAR_ZOOM_LEVELS[index];

    if (SUPPORTED_CALENDAR_VIEW_MODES.includes(level as CalendarViewMode)) {
      return level as CalendarViewMode;
    }
  }

  return currentMode;
}

function createCalendarCells(params: {
  calendar: CalendarDto | null;
  currentMonth: number | null;
  dateFrom: Date;
  dateTo: Date;
}): CalendarPeriodCell[] {
  const todayId = formatDateId(new Date());
  const daysByDate = new Map(
    params.calendar?.days.map((day) => [day.date, day]) ?? [],
  );
  const eventsByDate = groupEventsByDisplayDate(params.calendar?.layers ?? []);
  const cells: CalendarPeriodCell[] = [];

  for (
    let current = new Date(params.dateFrom);
    current <= params.dateTo;
    current = addDays(current, 1)
  ) {
    const dateId = formatDateId(current);

    cells.push({
      date: new Date(current),
      dateId,
      day: daysByDate.get(dateId) ?? null,
      events: eventsByDate.get(dateId) ?? [],
      isPrimaryPeriod:
        params.currentMonth === null ||
        current.getMonth() === params.currentMonth,
      isToday: dateId === todayId,
    });
  }

  return cells;
}

function groupEventsByDisplayDate(layers: CalendarDto["layers"]) {
  const result = new Map<string, CalendarLayerItemDto[]>();

  for (const layer of layers) {
    for (const item of layer.items) {
      const items = result.get(item.displayDate) ?? [];
      items.push(item);
      result.set(item.displayDate, items);
    }
  }

  return result;
}

function startOfCalendarWeek(value: Date): Date {
  const result = new Date(value);
  const weekday = getIsoWeekday(result);
  result.setDate(result.getDate() - (weekday - FIRST_WEEKDAY));

  return result;
}

function endOfCalendarWeek(value: Date): Date {
  const result = new Date(value);
  const weekday = getIsoWeekday(result);
  result.setDate(result.getDate() + (LAST_WEEKDAY - weekday));

  return result;
}

function getIsoWeekday(value: Date): number {
  const weekday = value.getDay();

  return weekday === 0 ? 7 : weekday;
}

function formatShortDate(value: Date): string {
  return `${String(value.getDate()).padStart(2, "0")}.${String(
    value.getMonth() + 1,
  ).padStart(2, "0")}`;
}

function formatShortDateWithYear(value: Date): string {
  return `${formatShortDate(value)}.${value.getFullYear()}`;
}

function formatWeekTitle(weekStart: Date, weekEnd: Date) {
  if (weekStart.getFullYear() !== weekEnd.getFullYear()) {
    return `${formatShortDateWithYear(weekStart)} - ${formatShortDateWithYear(
      weekEnd,
    )}`;
  }

  return `${formatShortDate(weekStart)} - ${formatShortDate(weekEnd)}`;
}

function addDays(value: Date, days: number): Date {
  const result = new Date(value);
  result.setDate(result.getDate() + days);

  return result;
}
