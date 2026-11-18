import { isDeepStrictEqual } from 'node:util';
import { HttpException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { IntegrationRegistry } from '../../integrations/integration-registry';
import { IntegrationFailure } from '../../integrations/integration-errors';
import { PrismaService } from '../../prisma/prisma.service';
import { assertTransactionPermission } from '../../auth/transaction-permission';
import {
  uuid,
  type ReceiptImportTransaction as Tx,
} from '../receipts/receipts-import.contract';
import { lockInvoiceSnapshot } from '../invoice-snapshot-lock';
import { readOneCInvoices } from './one-c-invoices';
import { saveInvoiceSnapshot } from './one-c-invoice-snapshot-store';
import { OneCInvoiceDocumentImport } from './one-c-invoice-document-import';
import type {
  Invoice,
  InvoiceImportResult,
} from './one-c-invoice-document-types';

const FLOW = 'warehouse.receipts';

export type InvoicePeriodOutcome = 'SUCCESS' | 'PARTIAL_FAILURE' | 'FAILED';

@Injectable()
export class OneCInvoicePeriodImportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: IntegrationRegistry,
    private readonly documents: OneCInvoiceDocumentImport,
  ) {}

  async importPeriod(
    code: string,
    period: Parameters<typeof readOneCInvoices>[1],
    signal?: AbortSignal,
    assertRunCurrent?: () => Promise<void>,
  ) {
    const connection = await this.prisma.$transaction((tx) =>
      this.connection(tx, code),
    );
    const observedAt = new Date();
    const invoices = await readOneCInvoices(
      this.registry
        .adapter(connection.source.systemType)
        .createHttpClient(connection.source),
      period,
      signal,
    );
    const receivedAt = new Date();
    const results: ({
      invoiceId: string;
      snapshotSaved: boolean;
    } & InvoiceImportResult)[] = [];
    for (const invoice of invoices) {
      signal?.throwIfAborted();
      await assertRunCurrent?.();
      let snapshotSaved = false;
      try {
        snapshotSaved = await this.saveSnapshot(
          code,
          connection,
          invoice,
          observedAt,
          receivedAt,
          signal,
        );
        const result = snapshotSaved
          ? await this.apply(code, invoice.id, observedAt, connection)
          : { outcome: 'SUPERSEDED' as const, groups: [] };
        results.push({ invoiceId: invoice.id, snapshotSaved, ...result });
      } catch (error) {
        signal?.throwIfAborted();
        let result: InvoiceImportResult = {
          outcome: 'FAILED',
          code:
            error instanceof IntegrationFailure
              ? error.code
              : 'ONE_C_INVOICE_IMPORT_FAILED',
          groups: [],
        };
        if (snapshotSaved) {
          // A lost COMMIT acknowledgement must never overwrite a committed result.
          try {
            await this.prisma.$executeRaw`
              UPDATE warehouse_invoice_snapshots SET result=${JSON.stringify(result)}::jsonb
              WHERE invoice_id=${invoice.id}::uuid
                AND observed_at=${observedAt} AND result IS NULL`;
            const [stored] = await this.prisma.$queryRaw<
              { result: InvoiceImportResult }[]
            >`
              SELECT result FROM warehouse_invoice_snapshots
              WHERE invoice_id=${invoice.id}::uuid
                AND observed_at=${observedAt} AND result IS NOT NULL`;
            if (stored) result = stored.result;
          } catch {
            // The returned failure remains visible when PostgreSQL is unavailable.
          }
        }
        results.push({ invoiceId: invoice.id, snapshotSaved, ...result });
      }
    }
    // Applied groups can be used for placement, but skipped warehouse groups
    // leave this period incomplete and must be fetched again.
    const documents = results.map((document) =>
      document.outcome === 'PROCESSED' &&
      document.groups.some(
        ({ status }) =>
          status === 'UNMAPPED' ||
          status === 'INACTIVE' ||
          status === 'AMBIGUOUS',
      )
        ? {
            ...document,
            outcome: 'FAILED' as const,
            code: 'ONE_C_INVOICE_WAREHOUSE_GROUPS_PENDING',
          }
        : document,
    );
    // A newer run may still be pending. Supersession alone cannot confirm delivery.
    const errorCount = documents.filter(
      ({ outcome }) => outcome !== 'PROCESSED',
    ).length;
    const outcome: InvoicePeriodOutcome =
      errorCount === 0
        ? 'SUCCESS'
        : errorCount === documents.length
          ? 'FAILED'
          : 'PARTIAL_FAILURE';
    return {
      sourceCode: code,
      period,
      received: invoices.length,
      outcome,
      errorCount,
      documents,
    };
  }

  private async saveSnapshot(
    code: string,
    connection: Awaited<
      ReturnType<OneCInvoicePeriodImportService['connection']>
    >,
    invoice: Invoice,
    observedAt: Date,
    receivedAt: Date,
    signal?: AbortSignal,
  ) {
    const save = () =>
      this.prisma.$transaction(async (tx) => {
        await this.assertConnection(tx, code, connection);
        return saveInvoiceSnapshot(
          tx,
          connection.source,
          invoice,
          observedAt,
          receivedAt,
        );
      });
    try {
      return await save();
    } catch (error) {
      if (error instanceof IntegrationFailure || error instanceof HttpException)
        throw error;
      signal?.throwIfAborted();
      // The same observation can be safely verified or written under the invoice lock.
      return save();
    }
  }

  async reprocess(code: string, invoiceId: string) {
    const connection = await this.prisma.$transaction((tx) =>
      this.connection(tx, code),
    );
    return this.apply(code, uuid(invoiceId), undefined, connection);
  }

  private async apply(
    code: string,
    invoiceId: string,
    observedAt: Date | undefined,
    expected: Awaited<ReturnType<OneCInvoicePeriodImportService['connection']>>,
  ): Promise<InvoiceImportResult> {
    return this.prisma.$transaction(
      async (tx) => {
        const { source } = await this.assertConnection(tx, code, expected);
        await lockInvoiceSnapshot(tx, invoiceId);
        const [snapshot] = await tx.$queryRaw<
          { payload: Prisma.JsonValue; observedAt: Date }[]
        >`
        SELECT payload,observed_at AS "observedAt" FROM warehouse_invoice_snapshots
        WHERE invoice_id=${invoiceId}::uuid FOR UPDATE`;
        if (!snapshot)
          throw new NotFoundException('Снимок накладной 1С не найден.');
        if (
          observedAt &&
          snapshot.observedAt.getTime() !== observedAt.getTime()
        )
          return { outcome: 'SUPERSEDED', groups: [] };
        const result = await this.documents.apply(
          tx,
          {
            code,
            actorUserId: source.actorUserId,
          },
          snapshot.payload as Invoice,
        );
        await tx.$executeRaw`
        UPDATE warehouse_invoice_snapshots SET result=${JSON.stringify(result)}::jsonb
        WHERE invoice_id=${invoiceId}::uuid`;
        return result;
      },
      { timeout: 30_000 },
    );
  }

  private async assertConnection(
    tx: Tx,
    code: string,
    expected: Awaited<ReturnType<OneCInvoicePeriodImportService['connection']>>,
  ) {
    await tx.$queryRaw`SELECT id FROM integration_sources WHERE code=${code} FOR SHARE`;
    const current = await this.connection(tx, code);
    if (
      current.source.id !== expected.source.id ||
      current.source.updatedAt.getTime() !==
        expected.source.updatedAt.getTime() ||
      !isDeepStrictEqual(
        current.source.flows[0]?.config,
        expected.source.flows[0]?.config,
      ) ||
      current.source.flows[0]?.configVersion !==
        expected.source.flows[0]?.configVersion
    )
      throw new IntegrationFailure('ONE_C_INVOICES_SOURCE_CHANGED', true);
    return current;
  }

  private async connection(tx: Tx, code: string) {
    const source = await tx.integrationSource.findUnique({
      where: { code },
      include: { flows: { where: { flowCode: FLOW } } },
    });
    if (!source) throw new NotFoundException('Источник 1С не найден.');
    await assertTransactionPermission(
      tx,
      source.actorUserId,
      'warehouse.receipts.integration',
      source.code,
    );
    const flow = source.flows[0];
    if (!source.isActive || !flow?.isActive)
      throw new IntegrationFailure('ONE_C_INVOICES_FLOW_DISABLED', false);
    this.registry.validateFlow(
      FLOW,
      source.systemType,
      flow.configVersion,
      flow.config,
    );
    if (!new URL(source.baseUrl).pathname.endsWith('/hs/docs/'))
      throw new IntegrationFailure('ONE_C_INVOICES_SOURCE_URL_INVALID', false);
    return {
      source,
    };
  }
}
