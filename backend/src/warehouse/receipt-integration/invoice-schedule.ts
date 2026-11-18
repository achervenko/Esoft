import { IntegrationFailure } from '../../integrations/integration-errors';
import { BUSINESS_TIME_ZONE } from '../../application/business-date';
import { invoiceTimestamp } from './one-c-invoices.validation';

const minute = 60_000;

export function readInvoiceSchedule(config: unknown) {
  if (!config || typeof config !== 'object' || Array.isArray(config))
    invalidSchedule();
  const values = config as Record<string, unknown>;
  const {
    enabled = false,
    intervalMinutes,
    intervalSeconds = minutes(intervalMinutes, 1) ? intervalMinutes * 60 : 30,
    periodMinutes = 60,
    overlapMinutes = 15,
    timezone = BUSINESS_TIME_ZONE,
    initialFrom,
  } = values;
  if (
    Object.keys(values).some(
      (key) =>
        ![
          'enabled',
          'intervalMinutes',
          'intervalSeconds',
          'periodMinutes',
          'overlapMinutes',
          'timezone',
          'initialFrom',
        ].includes(key),
    ) ||
    typeof enabled !== 'boolean' ||
    (intervalMinutes !== undefined && !minutes(intervalMinutes, 1)) ||
    typeof intervalSeconds !== 'number' ||
    !Number.isSafeInteger(intervalSeconds) ||
    intervalSeconds < 1 ||
    intervalSeconds > 86_400 ||
    !minutes(periodMinutes, 1) ||
    !minutes(overlapMinutes, 0) ||
    overlapMinutes >= periodMinutes ||
    typeof timezone !== 'string' ||
    !timezone.trim() ||
    (enabled && initialFrom === undefined)
  )
    invalidSchedule();
  let initial: Date | null = null;
  if (initialFrom !== undefined) {
    if (
      typeof initialFrom !== 'string' ||
      !invoiceTimestamp(initialFrom.slice(0, 19)) ||
      !/^.{19}(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/.test(initialFrom) ||
      !Number.isFinite(Date.parse(initialFrom))
    )
      invalidSchedule();
    initial = new Date(initialFrom);
  }
  const format = invoiceClock(timezone);
  return {
    enabled,
    intervalSeconds,
    periodMinutes,
    overlapMinutes,
    timezone,
    initial,
    format,
  };
}

function minutes(value: unknown, minimum: number): value is number {
  return (
    typeof value === 'number' &&
    Number.isSafeInteger(value) &&
    value >= minimum &&
    value <= 1440
  );
}

function invalidSchedule(): never {
  throw new IntegrationFailure('FLOW_CONFIG_UNSUPPORTED', false);
}

function invoiceClock(timezone: string) {
  let formatter: Intl.DateTimeFormat;
  try {
    formatter = new Intl.DateTimeFormat('sv-SE', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    });
  } catch {
    invalidSchedule();
  }
  return (date: Date) => formatter.format(date).replace(' ', 'T');
}

export function nextInvoiceWindow(
  schedule: ReturnType<typeof readInvoiceSchedule>,
  through: Date | null,
  now: Date,
) {
  if (!schedule.initial) return null;
  const available = Math.floor(now.getTime() / 1000) * 1000 - minute;
  const cursor = through?.getTime() ?? schedule.initial.getTime();
  if (available <= cursor) return null;
  const from = Math.max(
    through ? cursor - schedule.overlapMinutes * minute : cursor,
    Math.min(schedule.initial.getTime(), cursor),
  );
  return {
    from: new Date(from),
    to: new Date(Math.min(from + schedule.periodMinutes * minute, available)),
  };
}

export function invoiceRetryDelay(attempt: number) {
  return Math.min(30, 2 ** Math.min(attempt - 1, 5)) * minute;
}
