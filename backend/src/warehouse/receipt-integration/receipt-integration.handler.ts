import { Injectable, type OnModuleInit } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { IntegrationRegistry } from '../../integrations/integration-registry';
import type {
  IntegrationSkipResult,
  IntegrationFlowContext,
  IntegrationFlowHandler,
  IntegrationEventEnvelope,
  IntegrationScheduleSummary,
} from '../../integrations/integration.contracts';
import { IntegrationFailure } from '../../integrations/integration-errors';
import { assertTransactionPermission } from '../../auth/transaction-permission';
import {
  WarehouseReceiptImportService,
  ReceiptImportWarehouseError,
} from '../receipts/receipt-import.service';
import { parseSourceReceipt } from '../receipts/receipts-import.contract';
import {
  parseReceiptEvent,
  validateReceiptFlowConfig,
} from './receipt-integration.validation';
import { readInvoiceSchedule } from './invoice-schedule';

export async function applyReceiptIntegrationEvent(
  tx: Prisma.TransactionClient,
  importer: WarehouseReceiptImportService,
  context: IntegrationFlowContext,
): Promise<void | IntegrationSkipResult> {
  const { sourceCode, actorUserId, event, client } = context;
  let raw: unknown;
  try {
    raw = await client.getJson(
      'receipts/' + encodeURIComponent(event.objectId),
    );
  } catch (error) {
    if (error instanceof IntegrationFailure)
      throw new IntegrationFailure(
        error.code.replace(/^INTEGRATION_/, 'ONE_C_'),
        error.retryable,
      );
    throw error;
  }
  const document = parseSourceReceipt(raw, '1');
  if (document.id !== event.objectId)
    throw new IntegrationFailure('ONE_C_OBJECT_MISMATCH', false);
  try {
    await importer.applySnapshot(tx, sourceCode, raw, actorUserId);
  } catch (error) {
    if (error instanceof ReceiptImportWarehouseError) {
      if (!error.previouslyImported)
        return {
          outcome: 'SKIPPED',
          code: 'ONE_C_' + error.code,
          summary: {
            documentNumber: document.number,
            warehouseId: document.warehouse.id,
            warehouseName: document.warehouse.name,
          },
        };
      // Previously imported documents must never disappear behind a warehouse filter.
      throw new IntegrationFailure('ONE_C_' + error.code, false);
    }
    throw error;
  }
}

@Injectable()
export class WarehouseReceiptIntegrationHandler
  implements IntegrationFlowHandler, OnModuleInit
{
  readonly flowCode = 'warehouse.receipts';
  readonly name = 'Приходы склада';
  readonly owner = 'warehouse';
  readonly systemTypes = ['ONE_C'] as const;
  readonly configVersions = [1] as const;
  readonly incomingActions = ['event:create'] as const;
  readonly actorPermissions = ['warehouse.receipts.integration'] as const;
  constructor(
    private readonly prisma: PrismaService,
    private readonly importer: WarehouseReceiptImportService,
    private readonly registry: IntegrationRegistry,
  ) {}
  onModuleInit() {
    this.registry.registerFlow(this);
  }
  async readScheduleSummaries(
    tx: Prisma.TransactionClient,
    flows: readonly { sourceId: string; config: Prisma.JsonValue }[],
  ) {
    const summaries = new Map<string, IntegrationScheduleSummary>();
    for (const flow of flows) {
      if (readInvoiceSchedule(flow.config).enabled)
        summaries.set(flow.sourceId, { outcome: null, errorCode: null });
    }
    if (!summaries.size) return summaries;
    const states = await tx.warehouseInvoiceSyncState.findMany({
      where: {
        sourceId: { in: [...summaries.keys()] },
        flowCode: this.flowCode,
      },
      select: { sourceId: true, lastOutcome: true, lastErrorCode: true },
    });
    for (const state of states)
      summaries.set(state.sourceId, {
        outcome: state.lastOutcome,
        errorCode: state.lastErrorCode,
      });
    return summaries;
  }
  validateConfig(version: number, config: unknown) {
    validateReceiptFlowConfig(version, config);
  }
  validateEvent(event: IntegrationEventEnvelope) {
    const parsed = parseReceiptEvent(event);
    if (parsed.objectId === '.' || parsed.objectId === '..')
      throw new IntegrationFailure('FLOW_EVENT_INVALID', false);
  }
  async handle(context: IntegrationFlowContext) {
    this.validateConfig(context.configVersion, context.config);
    this.validateEvent(context.event);
    return this.prisma.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${JSON.stringify(['warehouse:receipt-sync', context.event.objectId.toLowerCase()])},0))`;
        await assertTransactionPermission(
          tx,
          context.actorUserId,
          'warehouse.receipts.integration',
          context.sourceCode,
        );
        const [periodDocument] = await tx.$queryRaw<{ exists: boolean }[]>`
          SELECT EXISTS (
            SELECT 1 FROM warehouse_invoice_snapshots s

            WHERE
              s.invoice_id::text=lower(${context.event.objectId})
          ) AS "exists"`;
        if (periodDocument.exists)
          throw new IntegrationFailure(
            'ONE_C_INVOICE_ALREADY_TRACKED_BY_PERIOD',
            false,
          );
        return applyReceiptIntegrationEvent(tx, this.importer, context);
      },
      { timeout: 20000, maxWait: 5000 },
    );
  }
}
