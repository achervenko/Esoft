import type {
  CalendarViewMode,
  CalendarZoomLevel,
} from "./calendar-page.types";

export const CALENDAR_MONTH_NAMES = [
  "Январь",
  "Февраль",
  "Март",
  "Апрель",
  "Май",
  "Июнь",
  "Июль",
  "Август",
  "Сентябрь",
  "Октябрь",
  "Ноябрь",
  "Декабрь",
] as const;

export const CALENDAR_WEEKDAY_LABELS = [
  "Пн",
  "Вт",
  "Ср",
  "Чт",
  "Пт",
  "Сб",
  "Вс",
] as const;

export const CALENDAR_MAX_EVENT_DOTS = 5;

export const CALENDAR_ZOOM_LEVELS: CalendarZoomLevel[] = [
  "year",
  "quarter",
  "month",
  "week",
  "day",
];

export const SUPPORTED_CALENDAR_VIEW_MODES: CalendarViewMode[] = [
  "month",
  "week",
];
