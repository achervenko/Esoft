export type ProductionCalendarPageProps = {
  userRole: string | null;
};

export type DayType = "working" | "weekend" | "holiday" | "shortened";

export type CalendarDayState = {
  comment: string;
  date: Date;
  id: string;
  isManual: boolean;
  type: DayType;
};

export type CalendarDayDraft = {
  comment: string;
  type: DayType;
};

export type MonthModel = {
  days: Array<CalendarDayState | null>;
  monthIndex: number;
  title: string;
};
