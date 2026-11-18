import {
  getBusinessDateString,
  getBusinessHour,
} from '../application/business-date';

export const ORDERS_FLOW = 'orders.customers';
export const CLOSED_ORDER_STATUS = 'Закрыт';
const ordersSyncHour = 3;
export const ORDERS_PAGE_SIZE = 200;
export const ORDERS_MAX_PAGES = 500;
export const ORDERS_SYNC_TIMEOUT_MS = 120_000;

export function latestOrdersRun(now: Date): Date {
  const dateId = getBusinessDateString(now);
  const due = getBusinessHour(dateId, ordersSyncHour);
  if (due <= now) return due;
  const previousDay = new Date(dateId + 'T00:00:00Z');
  previousDay.setUTCDate(previousDay.getUTCDate() - 1);
  return getBusinessHour(
    previousDay.toISOString().slice(0, 10),
    ordersSyncHour,
  );
}
