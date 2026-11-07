export const ORDERS_FLOW = 'orders.customers';
export const ORDERS_SCHEDULE = {
  hour: 3,
  timeZone: 'Europe/Moscow',
  utcOffset: '+03:00',
} as const;
export const ORDERS_PAGE_SIZE = 200;
export const ORDERS_MAX_PAGES = 500;
export const ORDERS_SYNC_TIMEOUT_MS = 120_000;

export function latestOrdersRun(now: Date): Date {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: ORDERS_SCHEDULE.timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(now)
      .map((p) => [p.type, p.value]),
  );
  const due = new Date(
    `${parts.year}-${parts.month}-${parts.day}T${String(ORDERS_SCHEDULE.hour).padStart(2, '0')}:00:00${ORDERS_SCHEDULE.utcOffset}`,
  );
  if (due > now) due.setUTCDate(due.getUTCDate() - 1);
  return due;
}
