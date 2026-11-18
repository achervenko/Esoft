import { randomUUID } from 'node:crypto';
import { NotFoundException } from '@nestjs/common';
import type { Prisma, WarehouseInvoiceSyncState } from '@prisma/client';
import { assertTransactionPermission } from '../../auth/transaction-permission';
import { readInvoiceSchedule } from './invoice-schedule';
import {
  configurationHashFor,
  invoiceRunCompletion,
  selectInvoiceWindow,
  type InvoiceRunResult,
} from './invoice-schedule-policy';

export const invoiceFlowCode = 'warehouse.receipts';

export async function readInvoiceRunStatus(
  tx: Prisma.TransactionClient,
  code: string,
  actor: string,
) {
  await assertTransactionPermission(tx, actor, 'integrations.manage');
  const flow = await tx.integrationFlow.findFirst({
    where: { flowCode: invoiceFlowCode, source: { code, systemType: 'ONE_C' } },
    select: {
      sourceId: true,
      config: true,
      isActive: true,
      source: { select: { isActive: true } },
    },
  });
  if (!flow) throw new NotFoundException();
  const where = { sourceId: flow.sourceId, flowCode: invoiceFlowCode };
  const state = await tx.warehouseInvoiceSyncState.findUnique({
    where: { sourceId_flowCode: where },
  });
  return {
    enabled:
      flow.isActive &&
      flow.source.isActive &&
      readInvoiceSchedule(flow.config).enabled,
    lastSuccessAt: state?.lastSuccessAt ?? null,
    latest: state
      ? {
          outcome: state.lastOutcome,
          periodFrom: state.periodFrom,
          periodTo: state.periodTo,
          syncedThrough: state.syncedThrough,
          startedAt: state.lastStartedAt,
          finishedAt: state.lastFinishedAt,
          attempt: state.attempt,
          nextAttemptAt: state.nextAttemptAt,
          errorCode: state.lastErrorCode,
        }
      : null,
  };
}

export async function claimInvoiceRun(
  tx: Prisma.TransactionClient,
  sourceId: string,
  now: Date,
  key: string,
  pid: number,
) {
  // Lock source settings briefly and check that this transaction's caller still owns the run.
  await tx.$queryRaw`SELECT id FROM integration_sources WHERE id=${sourceId}::uuid FOR UPDATE`;
  const [lock] = await tx.$queryRaw<{ acquired: boolean }[]>`
      SELECT EXISTS (
        SELECT 1 FROM pg_locks WHERE pid=${pid}::int AND locktype='advisory'
          AND granted AND objsubid=1
          AND classid::bigint=((hashtextextended(${key},0) >> 32) & 4294967295)
          AND objid::bigint=(hashtextextended(${key},0) & 4294967295)
      ) AS acquired`;
  if (!lock.acquired) return;
  const flow = await findActiveInvoiceFlow(tx, sourceId);
  if (!flow) return;
  const schedule = readInvoiceSchedule(flow.config);
  if (!schedule.enabled) return;
  const configurationHash = configurationHashFor(flow);
  const where = { sourceId, flowCode: invoiceFlowCode };
  const previous = await tx.warehouseInvoiceSyncState.findUnique({
    where: { sourceId_flowCode: where },
  });
  const decision = selectInvoiceWindow(
    schedule,
    previous,
    configurationHash,
    now,
  );
  if (!decision) return;
  const { window, attempt } = decision;
  const interrupted = previous?.lastOutcome === 'RUNNING';
  if (interrupted)
    await tx.warehouseInvoiceSyncRun.updateMany({
      where: { ...where, finishedAt: null },
      data: {
        outcome: 'INTERRUPTED',
        errorCode: 'ONE_C_INVOICE_SCHEDULE_INTERRUPTED',
        finishedAt: now,
      },
    });
  const data = {
    periodFrom: window.from,
    periodTo: window.to,
    attempt,
    consecutiveFailures:
      (previous?.consecutiveFailures ?? 0) + Number(interrupted),
    lastStartedAt: now,
    lastFinishedAt: null,
    lastOutcome: 'RUNNING',
    lastErrorCode: null,
    nextAttemptAt: null,
    configurationHash,
    ownerToken: randomUUID(),
  };
  const state = await tx.warehouseInvoiceSyncState.upsert({
    where: { sourceId_flowCode: where },
    create: { ...where, ...data },
    update: data,
  });
  const run = await tx.warehouseInvoiceSyncRun.create({
    data: {
      ...where,
      periodFrom: state.periodFrom,
      periodTo: state.periodTo,
      startedAt: now,
      attempt: state.attempt,
      outcome: 'RUNNING',
      configurationHash,
    },
  });
  return { run, state, flow, schedule };
}

export function findActiveInvoiceFlow(
  tx: Prisma.TransactionClient,
  sourceId: string,
) {
  return tx.integrationFlow.findFirst({
    where: {
      sourceId,
      flowCode: invoiceFlowCode,
      isActive: true,
      source: { isActive: true, systemType: 'ONE_C' },
    },
    include: { source: { select: { code: true, updatedAt: true } } },
  });
}

export async function finishInvoiceRun(
  owner: Prisma.TransactionClient,
  state: WarehouseInvoiceSyncState,
  runId: bigint,
  result: InvoiceRunResult,
) {
  const { sourceId } = state;
  const finishedAt = new Date();
  const { success, outcome, consecutiveFailures, nextAttemptAt } =
    invoiceRunCompletion(result, state.consecutiveFailures, finishedAt);
  const updated = await owner.warehouseInvoiceSyncState.updateMany({
    where: {
      sourceId,
      flowCode: invoiceFlowCode,
      ownerToken: state.ownerToken,
      lastOutcome: 'RUNNING',
    },
    data: {
      ownerToken: null,
      lastOutcome: outcome,
      lastFinishedAt: finishedAt,
      lastErrorCode: result.errorCode,
      consecutiveFailures,
      syncedThrough: success ? state.periodTo : state.syncedThrough,
      lastSuccessAt: success ? finishedAt : state.lastSuccessAt,
      nextAttemptAt,
    },
  });
  if (!updated.count) return;
  // Diagnostic history may be pruned independently of synchronization.
  await owner.warehouseInvoiceSyncRun.updateMany({
    where: { id: runId },
    data: { ...result, finishedAt, outcome },
  });
}
