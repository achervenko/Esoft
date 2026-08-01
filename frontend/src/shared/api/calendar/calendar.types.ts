export type CalendarDayType = "WORKING" | "WEEKEND" | "HOLIDAY" | "SHORTENED";

export type CalendarLayerCode = string;

export type CalendarItemSource = string;

export type CalendarNavigationDto = {
  params?: Record<string, boolean | number | string | null>;
  type: string;
};

export type CalendarSource = "SYSTEM" | "IMPORT" | "MANUAL";

export type CalendarWorkdayDto = {
  date: string;
  day: number;
  dayOfWeek: number;
  dayOfYear: number;
  holidayName: string | null;
  isHoliday: boolean;
  isPreholiday: boolean;
  isWorkingDay: boolean;
  isoWeekYear: number;
  month: number;
  quarter: number;
  source: CalendarSource;
  week: number;
  workingHours: number;
  year: number;
};

export type CalendarRangeResponse = {
  days: CalendarWorkdayDto[];
};

export type CalendarWorkdayUpdatePayload = {
  date: string;
  holidayName?: string | null;
  isHoliday?: boolean;
  isPreholiday?: boolean;
  isWorkingDay?: boolean;
  workingHours?: number;
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
