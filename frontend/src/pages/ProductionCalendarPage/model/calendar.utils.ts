import {
  MAX_CALENDAR_YEAR,
  MIN_CALENDAR_YEAR,
  MONTH_NAMES,
} from "./constants";
import type { CalendarDayState, DayType, MonthModel } from "./types";

export function createDefaultYearDays(
  year: number,
): Record<string, CalendarDayState> {
  const days: Record<string, CalendarDayState> = {};
  const date = new Date(year, 0, 1);

  while (date.getFullYear() === year) {
    const dateCopy = new Date(date);
    const id = formatDateId(dateCopy);

    days[id] = {
      comment: "",
      date: dateCopy,
      id,
      isManual: false,
      type: getDefaultDayType(dateCopy),
    };
    date.setDate(date.getDate() + 1);
  }

  return days;
}

export function createMonths(
  year: number,
  daysById: Record<string, CalendarDayState>,
): MonthModel[] {
  return MONTH_NAMES.map((title, monthIndex) => {
    const monthDays = Object.values(daysById)
      .filter((day) => day.date.getMonth() === monthIndex)
      .sort((left, right) => left.date.getTime() - right.date.getTime());
    const leadingEmptyCells = getIsoWeekday(new Date(year, monthIndex, 1)) - 1;

    return {
      days: [
        ...Array.from<null>({ length: leadingEmptyCells }).fill(null),
        ...monthDays,
      ],
      monthIndex,
      title,
    };
  });
}

export function getDefaultDayType(date: Date): DayType {
  const isoWeekday = getIsoWeekday(date);

  return isoWeekday >= 6 ? "weekend" : "working";
}

export function clampCalendarYear(year: number): number {
  return Math.min(MAX_CALENDAR_YEAR, Math.max(MIN_CALENDAR_YEAR, year));
}

export function getIsoWeekday(date: Date): number {
  const day = date.getDay();

  return day === 0 ? 7 : day;
}

export function formatDateId(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export function formatLongDate(date: Date): string {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    weekday: "long",
    year: "numeric",
  }).format(date);
}

export function isToday(date: Date): boolean {
  return formatDateId(date) === formatDateId(new Date());
}
