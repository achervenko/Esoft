export enum CalendarDayType {
  HOLIDAY = 'HOLIDAY',
  SHORTENED = 'SHORTENED',
  WEEKEND = 'WEEKEND',
  WORKING = 'WORKING',
}

export enum CalendarItemSource {
  EQUIPMENT = 'EQUIPMENT',
  MACHINES = 'MACHINES',
  PLANNING_RULES = 'PLANNING_RULES',
}

export enum CalendarLayerCode {
  EVENTS = 'EVENTS',
  PLANNING_RULES = 'PLANNING_RULES',
}

export type CalendarDayDto = {
  comment: string | null;
  date: string;
  isManual: boolean;
  type: CalendarDayType;
};

export type CalendarLayerItemDto = {
  details?: unknown;
  displayDate: string;
  factDate?: string | null;
  id: string;
  isOverdue?: boolean;
  overdueDays?: number;
  plannedDate?: string | null;
  source: CalendarItemSource;
  status?: string;
  title: string;
};

export type CalendarLayerDto = {
  code: CalendarLayerCode;
  items: CalendarLayerItemDto[];
  title: string;
};

export type CalendarDto = {
  days: CalendarDayDto[];
  layers: CalendarLayerDto[];
};

export type CalendarPeriod = {
  dateFrom: Date;
  dateTo: Date;
  today: Date;
};

export type CalendarProviderResult = {
  days?: CalendarDayDto[];
  layers?: CalendarLayerDto[];
};

export interface CalendarProvider {
  getCalendarData(period: CalendarPeriod): Promise<CalendarProviderResult>;
}
