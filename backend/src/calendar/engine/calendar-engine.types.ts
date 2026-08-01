export enum CalendarDayType {
  HOLIDAY = 'HOLIDAY',
  SHORTENED = 'SHORTENED',
  WEEKEND = 'WEEKEND',
  WORKING = 'WORKING',
}

export type CalendarItemSource = string;

export type CalendarLayerCode = string;

export type CalendarNavigationDto = {
  params?: Record<string, boolean | number | string | null>;
  type: string;
};

export type CalendarDayDto = {
  comment: string | null;
  date: string;
  isManual: boolean;
  type: CalendarDayType;
};

export type CalendarLayerItemDto = {
  badge?: string | null;
  description?: string | null;
  details?: unknown;
  displayDate: string;
  factDate?: string | null;
  icon?: string | null;
  id: string;
  isOverdue?: boolean;
  navigation?: CalendarNavigationDto | null;
  overdueDays?: number;
  plannedDate?: string | null;
  source: CalendarItemSource;
  status?: string;
  subtitle?: string | null;
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
