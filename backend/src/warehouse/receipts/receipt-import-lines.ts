import type { WarehouseCatalogService } from '../catalog/catalog.service';
import {
  Prisma,
  type WarehouseReceipt,
  type WarehouseReceiptLine,
} from '@prisma/client';
import type { SourceReceipt } from './receipts-import.contract';
import type { Tx } from './receipts.policy';
import type { WarehouseCatalogExternalLinksService } from '../catalog/catalog-external-links.service';

type Bindings = Awaited<
  ReturnType<WarehouseCatalogExternalLinksService['resolveMany']>
>;
export async function saveReceiptImportLines(
  tx: Tx,
  receiptId: bigint,
  input: SourceReceipt,
  oldLines: WarehouseReceiptLine[],
  bindings: Bindings,
) {
  // Unplaced removed lines can be replaced; rows referenced by placements retain their IDs.
  for (const old of oldLines)
    if (!input.lines.some((l) => l.id === old.externalLineId))
      await tx.warehouseReceiptLine.delete({ where: { id: old.id } });
  for (const line of input.lines)
    await saveLine(
      tx,
      receiptId,
      line,
      bindings.find((binding) => binding.externalId === line.item.id)?.itemId ??
        null,
    );
}

async function saveLine(
  tx: Tx,
  receiptId: bigint,
  line: SourceReceipt['lines'][number],
  resolvedItemId: string | null,
) {
  const data = {
    rowNumber: line.rowNumber,
    itemId: resolvedItemId === null ? null : BigInt(resolvedItemId),
    externalItemId: line.item.id,
    quantity: line.quantity,
    unitSnapshot: line.item.unit,
    itemArticleSnapshot: line.item.article,
    itemNameSnapshot: line.item.name,
    sourceType: line.item.type,
    orderSnapshot: line.order ?? Prisma.DbNull,
  };
  await tx.warehouseReceiptLine.upsert({
    where: {
      receiptId_externalLineId: { receiptId, externalLineId: line.id },
    },
    create: { receiptId, externalLineId: line.id, ...data },
    update: data,
  });
}

export async function prepareReceiptImportLines(
  tx: Tx,
  sourceSystem: string,
  input: SourceReceipt,
  previousId: bigint | null,
  links: WarehouseCatalogExternalLinksService,
  catalog: WarehouseCatalogService,
) {
  await links.lockIdentities(
    tx,
    input.lines.map((l) => ({ sourceSystem, externalId: l.item.id })),
  );
  if (previousId !== null)
    await tx.$queryRaw`SELECT id FROM warehouse_receipts WHERE id=${previousId} FOR UPDATE`;
  const bindings = await links.resolveMany(
    tx,
    input.lines.map((line) => ({ sourceSystem, externalId: line.item.id })),
  );
  await catalog.lockItemsForOperation(
    bindings.map((link) => link.itemId),
    tx,
  );
  const oldLines =
    previousId !== null
      ? await tx.warehouseReceiptLine.findMany({
          where: { receiptId: previousId },
        })
      : [];
  return { bindings, oldLines };
}

export async function saveReceiptImportDocument(
  tx: Tx,
  input: SourceReceipt,
  previous: WarehouseReceipt | null,
  sourceSystem: string,
  warehouseId: bigint,
  actor: string,
  sourceData: { sourceVersion: bigint; requestHash: string; receivedAt: Date },
) {
  const identity = {
    source: 'ONE_C',
    sourceSystem,
    sourceOperationId: input.id,
  };
  const row = previous
    ? await tx.warehouseReceipt.update({
        where: { id: previous.id },
        data: {
          ...sourceData,
          sourcePayload: input,
          pendingPayload: Prisma.DbNull,
          conflict: null,
          warehouseId: warehouseId,
          externalWarehouseId: input.warehouse.id,
          warehouseNameSnapshot: input.warehouse.name,
          documentNumber: input.number,
          documentDate: new Date(input.date + 'T00:00:00Z'),
          status:
            input.status === 'CANCELLED'
              ? 'CANCELLED'
              : previous.status === 'CANCELLED'
                ? 'RECEIVED'
                : previous.status,
        },
      })
    : await tx.warehouseReceipt.create({
        data: {
          ...identity,
          ...sourceData,
          sourcePayload: input,
          warehouseId: warehouseId,
          externalWarehouseId: input.warehouse.id,
          warehouseNameSnapshot: input.warehouse.name,
          documentNumber: input.number,
          documentDate: new Date(input.date + 'T00:00:00Z'),
          status: input.status === 'CANCELLED' ? 'CANCELLED' : 'RECEIVED',
          createdByUserId: actor,
        },
      });
  return row;
}
