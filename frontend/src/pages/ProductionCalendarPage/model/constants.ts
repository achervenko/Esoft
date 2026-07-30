import type { DayType } from "./types";

export const DAY_TYPES: DayType[] = [
  "working",
  "weekend",
  "holiday",
  "shortened",
];

export const DAY_TYPE_LABELS: Record<DayType, string> = {
  working: "Рабочий",
  weekend: "Выходной",
  holiday: "Праздничный",
  shortened: "Сокращённый",
};

export const MONTH_NAMES = [
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
];

export const WEEKDAY_LABELS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

export const MIN_CALENDAR_YEAR = 2000;
export const MAX_CALENDAR_YEAR = 2100;
