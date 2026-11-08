import type { WarehouseCatalogService } from '../catalog/catalog.service';
import { Prisma } from '@prisma/client';
export const receiptInclude = {
  settlementAdjustments: { select: { id: true, quantity: true, type: true } },
  createdBy: { select: { id: true, name: true } },
  lines: {
    orderBy: { rowNumber: 'asc' as const },
    include: {
      placements: { orderBy: { id: 'asc' as const } },
      reconciledLines: { include: { placements: true } },
    },
  },
} satisfies Prisma.WarehouseReceiptInclude;
export function placementDto(
  p: Prisma.WarehouseReceiptPlacementGetPayload<object>,
) {
  return {
    id: String(p.id),
    receiptLineId: String(p.receiptLineId),
    storageLocationId: String(p.storageLocationId),
    quantity: p.quantity.toString(),
    item: p.itemSnapshot,
    location: p.locationSnapshot,
    createdByUserId: p.createdByUserId,
    createdAt: p.createdAt.toISOString(),
  };
}
export type ReceiptRow = Prisma.WarehouseReceiptGetPayload<{
  include: typeof receiptInclude;
}>;
export async function receiptView(
  row: ReceiptRow,
  catalog: WarehouseCatalogService,
  tx: Prisma.TransactionClient,
) {
  const items = await catalog.getItemsForDisplay(
    row.lines.flatMap((line) =>
      line.itemId === null ? [] : [String(line.itemId)],
    ),
    tx,
  );
  return receiptDto(row, new Map(items.map((item) => [item.id, item.article])));
}
export function receiptDto(
  row: ReceiptRow,
  articles: ReadonlyMap<string, string>,
) {
  const lines = row.lines.map((l) => {
    const placements = [
      ...l.placements,
      ...l.reconciledLines.flatMap((m) => m.placements),
    ];
    const placed = placements.reduce(
      (sum, p) => sum.plus(p.quantity),
      new Prisma.Decimal(0),
    );
    return {
      id: String(l.id),
      rowNumber: l.rowNumber,
      externalLineId: l.externalLineId,
      itemId: l.itemId === null ? null : String(l.itemId),
      externalItemId: l.externalItemId,
      article:
        l.itemId === null ? null : (articles.get(String(l.itemId)) ?? null),
      // A suggestion for catalog creation, never a fallback for the working article.
      sourceArticle: row.source === 'ONE_C' ? l.itemArticleSnapshot : null,
      name: l.itemNameSnapshot,
      unit: l.unitSnapshot,
      sourceType: l.sourceType,
      problems: [
        ...(l.itemId === null
          ? [
              {
                code: 'WAREHOUSE_RECEIPT_UNMAPPED',
                message: 'Номенклатура не сопоставлена.',
              },
            ]
          : []),
        ...(l.sourceType !== 'GOODS'
          ? [
              {
                code: 'WAREHOUSE_RECEIPT_ITEM_TYPE',
                message: `Документ ${row.documentNumber ?? row.id}, строка ${l.rowNumber}: тип «${l.sourceType}» нельзя разместить на склад.`,
              },
            ]
          : []),
      ],
      quantity: l.quantity.toString(),
      placed: placed.toString(),
      remaining: l.quantity.minus(placed).toString(),
      order: l.orderSnapshot,
      mappingStatus: l.itemId === null ? 'UNMAPPED' : 'MAPPED',
      reconciledToLineId:
        l.reconciledToLineId === null ? null : String(l.reconciledToLineId),
      placements: placements.map(placementDto),
    };
  });
  return {
    id: String(row.id),
    warehouseId: row.warehouseId === null ? null : String(row.warehouseId),
    warehouseNameSnapshot: row.warehouseNameSnapshot,
    source: row.source,
    sourceSystem: row.sourceSystem,
    externalId: row.source === 'ONE_C' ? row.sourceOperationId : null,
    sourceVersion: row.sourceVersion?.toString() ?? null,
    externalWarehouseId: row.externalWarehouseId,
    sourceDocument: row.sourcePayload,
    pendingSourceDocument: row.pendingPayload,
    status: row.status,
    conflict: row.conflict,
    hasProblems:
      !!row.conflict ||
      row.warehouseId === null ||
      lines.some((l) => l.itemId === null || l.sourceType !== 'GOODS'),
    settlementAdjustments: row.settlementAdjustments.map((a) => ({
      id: String(a.id),
      quantity: a.quantity.toString(),
      type: a.type,
    })),
    documentNumber: row.documentNumber,
    documentDate: row.documentDate?.toISOString().slice(0, 10) ?? null,
    comment: row.comment,
    createdBy: row.createdBy,
    createdByUserId: row.createdByUserId,
    createdAt: row.createdAt.toISOString(),
    receivedAt: row.receivedAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    placedAt: row.placedAt?.toISOString() ?? null,
    lines,
    totalQuantity: lines
      .reduce((sum, line) => sum.plus(line.quantity), new Prisma.Decimal(0))
      .toString(),
    placedQuantity: lines
      .reduce((sum, line) => sum.plus(line.placed), new Prisma.Decimal(0))
      .toString(),
    lineCount: lines.length,
    placedLineCount: lines.filter((l) => l.remaining === '0').length,
  };
}
