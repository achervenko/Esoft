import type {
  CalendarDayDto,
  CalendarLayerItemDto,
} from "../../../shared/api/calendar";

export type CalendarPeriodCell = {
  date: Date;
  dateId: string;
  day: CalendarDayDto | null;
  events: CalendarLayerItemDto[];
  isPrimaryPeriod: boolean;
  isToday: boolean;
};

export type CalendarViewMode = "month" | "week";

export type CalendarZoomDirection = "in" | "out";

export type CalendarZoomLevel = "year" | "quarter" | CalendarViewMode | "day";

export type CalendarPeriodModel = {
  cells: CalendarPeriodCell[];
  dateFrom: string;
  dateTo: string;
  month: number;
  title: string;
  year: number;
};
