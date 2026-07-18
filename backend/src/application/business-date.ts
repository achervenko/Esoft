export const BUSINESS_TIME_ZONE = 'Europe/Moscow';

export function getBusinessTodayDateString() {
  const parts = new Intl.DateTimeFormat('en-US', {
    day: '2-digit',
    month: '2-digit',
    timeZone: BUSINESS_TIME_ZONE,
    year: 'numeric',
  }).formatToParts(new Date());

  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value]),
  );

  return `${values.year}-${values.month}-${values.day}`;
}

export function getBusinessTodayDate() {
  return new Date(`${getBusinessTodayDateString()}T00:00:00.000Z`);
}
