import { ForbiddenException } from '@nestjs/common';
import type { Prisma, WarehouseInvoiceSyncState } from '@prisma/client';
import { IntegrationFailure } from '../../integrations/integration-errors';
import { receiptHash } from '../receipts/receipts-import.contract';
import type { importScheduledInvoiceWindow } from './invoice-schedule-import';
import {
  invoiceRetryDelay,
  nextInvoiceWindow,
  type readInvoiceSchedule,
} from './invoice-schedule';

export type InvoiceRunResult = Awaited<
  ReturnType<typeof importScheduledInvoiceWindow>
>;

const administrativeErrors = new Set([
  'INTEGRATION_HTTP_401',
  'INTEGRATION_HTTP_403',
  'INTEGRATION_HTTP_404',
  'FLOW_CONFIG_UNSUPPORTED',
  'ONE_C_INVOICES_SOURCE_URL_INVALID',
  'FORBIDDEN',
]);

export function configurationHashFor(flow: {
  config: Prisma.JsonValue;
  configVersion: number;
  source: { updatedAt: Date };
}) {
  return receiptHash({
    config: flow.config,
    version: flow.configVersion,
    sourceUpdatedAt: flow.source.updatedAt.toISOString(),
  });
}
export function assertInvoiceConfiguration(
  flow: Parameters<typeof configurationHashFor>[0] | null,
  hash: string,
) {
  if (!flow || configurationHashFor(flow) !== hash)
    throw new IntegrationFailure('ONE_C_INVOICE_SCHEDULE_CHANGED', true);
}

export function selectInvoiceWindow(
  schedule: ReturnType<typeof readInvoiceSchedule>,
  previous: WarehouseInvoiceSyncState | null,
  configurationHash: string,
  now: Date,
) {
  const sameConfiguration = previous?.configurationHash === configurationHash;
  const pending = previous && previous.lastOutcome !== 'SUCCESS';
  if (
    pending &&
    sameConfiguration &&
    (previous.lastOutcome === 'BLOCKED' ||
      (previous.nextAttemptAt && previous.nextAttemptAt > now))
  )
    return;
  if (
    !pending &&
    previous?.lastFinishedAt &&
    previous.periodTo.getTime() >=
      Math.floor(previous.lastStartedAt.getTime() / 1000) * 1000 - 60_000 &&
    previous.lastFinishedAt.getTime() + schedule.intervalSeconds * 1000 >
      now.getTime()
  )
    return;
  const window = pending
    ? { from: previous.periodFrom, to: previous.periodTo }
    : nextInvoiceWindow(schedule, previous?.syncedThrough ?? null, now);
  return window
    ? { window, attempt: pending ? previous.attempt + 1 : 1 }
    : undefined;
}

export function interruptionCode(signal: AbortSignal, deadline: AbortSignal) {
  if (signal.aborted) return 'ONE_C_INVOICE_SCHEDULE_INTERRUPTED';
  if (deadline.aborted) return 'ONE_C_INVOICES_TIMEOUT';
  return null;
}

export function invoiceRunFailure(
  error: unknown,
  signal: AbortSignal,
  deadline: AbortSignal,
): InvoiceRunResult {
  const errorCode =
    interruptionCode(signal, deadline) ??
    (error instanceof IntegrationFailure
      ? error.code
      : error instanceof ForbiddenException
        ? 'FORBIDDEN'
        : 'ONE_C_INVOICE_SCHEDULE_FAILED');
  return {
    outcome: 'FAILED',
    errorCode,
    received: 0,
    processed: 0,
    skipped: 0,
    errors: 0,
  };
}

export function invoiceRunCompletion(
  result: InvoiceRunResult,
  failures: number,
  finishedAt: Date,
) {
  const success = result.outcome === 'SUCCESS';
  const blocked =
    !!result.errorCode && administrativeErrors.has(result.errorCode);
  const outcome = blocked ? 'BLOCKED' : result.outcome;
  const consecutiveFailures = success ? 0 : failures + 1;
  const nextAttemptAt =
    success || blocked
      ? null
      : new Date(finishedAt.getTime() + invoiceRetryDelay(consecutiveFailures));
  return { success, outcome, consecutiveFailures, nextAttemptAt };
}
