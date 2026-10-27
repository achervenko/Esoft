export const BUSINESS_TIME_ZONE = 'Europe/Moscow';
export const DATABASE_DATE_TIME_ZONE = 'UTC';

export function getBusinessDateString(value: Date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    day: '2-digit',
    month: '2-digit',
    timeZone: BUSINESS_TIME_ZONE,
    year: 'numeric',
  }).formatToParts(value);

  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value]),
  );

  return `${values.year}-${values.month}-${values.day}`;
}

export function getBusinessTodayDateString() {
  return getBusinessDateString(new Date());
}

// A calendar-date marker for SQL DATE fields, not the instant of Moscow midnight.
export function getBusinessTodayDate() {
  return new Date(`${getBusinessTodayDateString()}T00:00:00.000Z`);
}

export function getBusinessDayStart(dateId: string) {
  const [year, month, day] = dateId.split('-').map(Number);
  const utcMidnight = new Date(Date.UTC(year, month - 1, day));
  const offsetMinutes = getTimeZoneOffsetMinutes(
    utcMidnight,
    BUSINESS_TIME_ZONE,
  );

  return new Date(utcMidnight.getTime() - offsetMinutes * 60_000);
}

function getTimeZoneOffsetMinutes(value: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
    minute: '2-digit',
    month: '2-digit',
    second: '2-digit',
    timeZone,
    year: 'numeric',
  }).formatToParts(value);
  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value]),
  );
  const timeZoneDateAsUtc = Date.UTC(
    Number(values.year),
    Number(values.month) - 1,
    Number(values.day),
    Number(values.hour),
    Number(values.minute),
    Number(values.second),
  );

  return (timeZoneDateAsUtc - value.getTime()) / 60_000;
}
