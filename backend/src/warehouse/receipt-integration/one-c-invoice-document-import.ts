import { Injectable } from '@nestjs/common';
import type { ReceiptImportTransaction as Tx } from '../receipts/receipts-import.contract';
import { WarehouseReceiptImportService } from '../receipts/receipt-import.service';
import { groupInvoiceLinesByWarehouse } from './one-c-invoice-groups';
import {
  hasStructuralChange,
  matchWarehouseGroups,
  removedGroups,
} from './one-c-invoice-document-groups';
import {
  findInvoiceOrders,
  importInvoiceGroup,
  suspendInvoiceGroups,
} from './one-c-invoice-document-operations';
import type {
  GroupResult,
  Invoice,
  InvoiceImportResult,
  InvoiceImportSource,
} from './one-c-invoice-document-types';

@Injectable()
export class OneCInvoiceDocumentImport {
  constructor(private readonly importer: WarehouseReceiptImportService) {}

  async apply(
    tx: Tx,
    source: InvoiceImportSource,
    invoice: Invoice,
  ): Promise<InvoiceImportResult> {
    const groups = groupInvoiceLinesByWarehouse(invoice);
    const legacy = await this.importer.findLegacyInvoiceReceipt(tx, invoice.id);
    if (legacy)
      return {
        outcome: 'FAILED',
        code: 'ONE_C_INVOICE_LEGACY_RECEIPT_EXISTS',
        groups: [],
      };
    const results: GroupResult[] = [];
    // Single-document import and manual mapping also take item locks before receipt rows.
    if (invoice.status === 'POSTED')
      await this.importer.lockItemIdentities(
        tx,
        source.code,
        groups.flatMap((group) => group.lines.map((line) => line.item.id)),
      );
    const eligible =
      invoice.status === 'POSTED'
        ? await matchWarehouseGroups(
            this.importer,
            tx,
            source.code,
            groups,
            results,
          )
        : [];
    const previous = await this.importer.lockInvoiceGroups(tx, invoice.id);
    const placed = previous.length
      ? await this.importer.findPlacedInvoiceGroups(tx, previous)
      : new Set<bigint>();
    const desired = new Map(groups.map((group) => [group.operationId, group]));
    const structuralChange = hasStructuralChange(
      previous,
      placed,
      desired,
      invoice,
    );
    if (invoice.status !== 'POSTED' || structuralChange) {
      const groups = await suspendInvoiceGroups(
        this.importer,
        tx,
        source,
        previous,
        placed,
        desired,
        invoice,
      );
      return { outcome: 'PROCESSED', groups };
    }

    // Removed groups are stopped in the same transaction that creates a new group.
    for (const receipt of removedGroups(previous, desired))
      await this.importer.suspendInvoiceGroup(
        tx,
        source.actorUserId,
        receipt,
        null,
        invoice,
      );

    const orders = await findInvoiceOrders(tx, eligible);
    for (const group of eligible)
      results.push(
        await importInvoiceGroup(
          this.importer,
          tx,
          source,
          invoice,
          group,
          orders,
        ),
      );
    return { outcome: 'PROCESSED', groups: results };
  }
}
