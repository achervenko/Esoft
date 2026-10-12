export const DAY = 86_400_000;
export const maxDate = (...dates: Date[]) =>
  new Date(Math.max(...dates.map(Number)));
export const monthStart = (date: Date) =>
  new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
export function addMonths(date: Date, months: number) {
  if (date.getUTCFullYear() * 12 + date.getUTCMonth() + months >= 10000 * 12)
    return new Date('9999-12-31T00:00:00Z');
  const target = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1),
  );
  const last = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
  ).getUTCDate();
  target.setUTCDate(Math.min(date.getUTCDate(), last));
  return target;
}

export function addPeriod(
  date: Date,
  item: { periodCount: number; periodUnit: string },
): Date | null {
  const max = Date.parse('9999-12-31T00:00:00Z');
  if (item.periodUnit === 'DAY') {
    const next = Number(date) + item.periodCount * DAY;
    return next <= max ? new Date(next) : null;
  }
  const months = item.periodCount * (item.periodUnit === 'YEAR' ? 12 : 1);
  if (date.getUTCFullYear() * 12 + date.getUTCMonth() + months >= 10000 * 12)
    return null;
  return addMonths(date, months);
}
