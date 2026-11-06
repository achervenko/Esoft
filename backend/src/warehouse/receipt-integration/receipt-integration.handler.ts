import { Injectable, type OnModuleInit } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { IntegrationRegistry } from '../../integrations/integration-registry';
import type {
  IntegrationSkipResult,
  IntegrationFlowContext,
  IntegrationFlowHandler,
  IntegrationEventEnvelope,
} from '../../integrations/integration.contracts';
import { IntegrationFailure } from '../../integrations/integration-errors';
import { assertTransactionPermission } from '../../auth/transaction-permission';
import {
  WarehouseReceiptImportService,
  ReceiptImportWarehouseError,
} from '../receipts/receipt-import.service';
import { parseSourceReceipt } from '../receipts/receipts-import.contract';
import { parseReceiptEvent } from './receipt-integration.validation';

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
  validateConfig(version: number, config: unknown) {
    if (
      version !== 1 ||
      !config ||
      typeof config !== 'object' ||
      Array.isArray(config) ||
      Object.keys(config).length
    )
      throw new IntegrationFailure('FLOW_CONFIG_UNSUPPORTED', true);
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
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${JSON.stringify(['warehouse:receipt-sync', context.sourceCode, context.event.objectId])},0))`;
        await assertTransactionPermission(
          tx,
          context.actorUserId,
          'warehouse.receipts.integration',
          context.sourceCode,
        );
        return applyReceiptIntegrationEvent(tx, this.importer, context);
      },
      { timeout: 20000, maxWait: 5000 },
    );
  }
}
