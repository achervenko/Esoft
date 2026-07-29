export const CALENDAR_START_DATE = '2000-01-01';
export const CALENDAR_END_DATE = '2100-12-31';
export const CALENDAR_MAX_HOLES = 50;
export const CALENDAR_RANGE_LIMIT_DAYS = 370;
export const DEFAULT_WORKING_HOURS = 8;
export const MS_PER_DAY = 86_400_000;

export const CALENDAR_START = new Date(`${CALENDAR_START_DATE}T00:00:00.000Z`);
export const CALENDAR_END = new Date(
  `${CALENDAR_END_DATE}T00:00:00.000Z`,
);

export const CALENDAR_EXPECTED_DAYS =
  daysBetweenInclusive(CALENDAR_START, CALENDAR_END);

function daysBetweenInclusive(dateFrom: Date, dateTo: Date): number {
  return Math.floor((dateTo.getTime() - dateFrom.getTime()) / MS_PER_DAY) + 1;
}
