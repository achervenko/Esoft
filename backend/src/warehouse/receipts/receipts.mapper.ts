import { Prisma } from '@prisma/client';
export const receiptInclude = {
  lines: { orderBy: { rowNumber: 'asc' as const } },
  createdBy: { select: { id: true, name: true } },
} satisfies Prisma.WarehouseReceiptInclude;
export function receiptDto(
  row: Prisma.WarehouseReceiptGetPayload<{ include: typeof receiptInclude }>,
) {
  return {
    source: row.source,
    documentNumber: row.documentNumber,
    comment: row.comment,
    warehouseNameSnapshot: row.warehouseNameSnapshot,
    createdByUserId: row.createdByUserId,
    createdBy: row.createdBy,
    id: String(row.id),
    warehouseId: String(row.warehouseId),
    documentDate: row.documentDate?.toISOString().slice(0, 10) ?? null,
    createdAt: row.createdAt.toISOString(),
    lines: row.lines.map((line) => ({
      ...line,
      id: String(line.id),
      receiptId: String(line.receiptId),
      itemId: String(line.itemId),
      storageLocationId: String(line.storageLocationId),
      quantity: line.quantity.toString(),
    })),
  };
}
