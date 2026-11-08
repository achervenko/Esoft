import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  receiptReconciliationCandidates,
  receiptReconciliationHints,
} from './receipt-reconciliation-candidates.query';
import { parseReceiptQuery } from './receipts.validation';
@Injectable()
export class WarehouseReceiptsQueryService {
  constructor(private readonly prisma: PrismaService) {}
  reconciliationCandidates(id: string) {
    return this.prisma.$transaction(
      (tx) => receiptReconciliationCandidates(tx, id),
      {
        isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
      },
    );
  }
  list(value: unknown) {
    const q = parseReceiptQuery(value);
    const problem: Prisma.WarehouseReceiptWhereInput = {
      OR: [
        { conflict: { not: null } },
        { warehouseId: null },
        {
          lines: {
            some: { OR: [{ itemId: null }, { sourceType: { not: 'GOODS' } }] },
          },
        },
      ],
    };
    const where: Prisma.WarehouseReceiptWhereInput = {
      warehouseId: q.warehouseId,
      source: q.source,
      ...(q.hasConflict === 'true'
        ? { conflict: { not: null } }
        : q.hasConflict === 'false'
          ? { conflict: null }
          : {}),
      ...(q.includeConflicts
        ? { OR: [{ status: { in: q.status } }, { conflict: { not: null } }] }
        : { status: { in: q.status } }),
      createdByUserId: q.createdByUserId,
      createdAt: { gte: q.createdFrom, lte: q.createdTo },
      documentDate: {
        gte: q.documentDateFrom
          ? new Date(`${q.documentDateFrom}T00:00:00Z`)
          : undefined,
        lte: q.documentDateTo
          ? new Date(`${q.documentDateTo}T00:00:00Z`)
          : undefined,
      },
      ...(q.itemId !== undefined
        ? { lines: { some: { itemId: q.itemId } } }
        : {}),
      AND: [
        ...(q.hasProblems === 'true'
          ? [problem]
          : q.hasProblems === 'false'
            ? [{ NOT: problem }]
            : []),
        ...(q.search
          ? [
              {
                OR: [
                  {
                    documentNumber: {
                      contains: q.search.replace(/[\\%_]/g, '\\$&'),
                      mode: 'insensitive' as const,
                    },
                  },
                  {
                    lines: {
                      some: {
                        item: {
                          OR: [
                            {
                              name: {
                                contains: q.search.replace(/[\\%_]/g, '\\$&'),
                                mode: 'insensitive' as const,
                              },
                            },
                            {
                              article: {
                                contains: q.search.replace(/[\\%_]/g, '\\$&'),
                                mode: 'insensitive' as const,
                              },
                            },
                          ],
                        },
                      },
                    },
                  },
                ],
              },
            ]
          : []),
      ],
    };
    return this.prisma.$transaction(
      async (tx) => {
        const conditions: Prisma.WarehouseReceiptWhereInput[] = [];
        if (q.attention === 'WAREHOUSE') conditions.push({ warehouseId: null });
        if (q.attention === 'ITEMS')
          conditions.push({
            lines: { some: { itemId: null, sourceType: 'GOODS' } },
          });
        const filteredWhere: Prisma.WarehouseReceiptWhereInput = {
          AND: [where, ...conditions],
        };
        if (q.attention === 'MANUAL_DUPLICATE') {
          const targets = await tx.warehouseReceipt.findMany({
            where: {
              AND: [
                filteredWhere,
                {
                  source: 'ONE_C',
                  warehouseId: { not: null },
                  conflict: null,
                  status: { not: 'CANCELLED' },
                },
              ],
            },
            select: { id: true },
          });
          const hints = new Set<bigint>();
          // Bound SQL parameters without applying pagination before the exact duplicate filter.
          for (let start = 0; start < targets.length; start += 1000) {
            for (const id of await receiptReconciliationHints(
              tx,
              targets.slice(start, start + 1000).map((row) => row.id),
            ))
              hints.add(id);
          }
          filteredWhere.AND = [
            where,
            ...conditions,
            { id: { in: [...hints] } },
          ];
        }
        const rows = await tx.warehouseReceipt.findMany({
          where: filteredWhere,
          skip: q.offset,
          take: q.limit,
          orderBy: [{ [q.sortBy]: q.sortOrder }, { id: q.sortOrder }],
          select: {
            id: true,
            warehouseId: true,
            warehouseNameSnapshot: true,
            source: true,
            sourceSystem: true,
            status: true,
            conflict: true,
            documentNumber: true,
            documentDate: true,
            createdAt: true,
            receivedAt: true,
            placedAt: true,
            createdByUserId: true,
            createdBy: { select: { id: true, name: true } },
            _count: { select: { lines: true } },
          },
        });
        const progress = rows.length
          ? await tx.$queryRaw<
              {
                receipt_id: bigint;
                completed: bigint;
                unmapped: bigint;
                unmapped_items: bigint;
                expected_quantity: Prisma.Decimal;
                placed_quantity: Prisma.Decimal;
              }[]
            >`SELECT l.receipt_id,SUM(l.quantity) AS expected_quantity,SUM(COALESCE(p.quantity,0)) AS placed_quantity,COUNT(*) FILTER(WHERE COALESCE(p.quantity,0)>=l.quantity) AS completed, COUNT(*) FILTER(WHERE l.item_id IS NULL AND l.source_type='GOODS') AS unmapped_items, COUNT(*) FILTER(WHERE l.item_id IS NULL OR l.source_type<>'GOODS') AS unmapped FROM warehouse_receipt_lines l LEFT JOIN LATERAL(SELECT SUM(p.quantity) AS quantity FROM warehouse_receipt_placements p JOIN warehouse_receipt_lines actual ON actual.id=p.receipt_line_id WHERE actual.id=l.id OR actual.reconciled_to_line_id=l.id)p ON TRUE WHERE l.receipt_id IN (${Prisma.join(rows.map((r) => r.id))}) GROUP BY l.receipt_id`
          : [];
        const hints = await receiptReconciliationHints(
          tx,
          rows
            .filter(
              (row) =>
                row.source === 'ONE_C' &&
                row.warehouseId !== null &&
                !row.conflict &&
                row.status !== 'CANCELLED',
            )
            .map((row) => row.id),
        );
        const total = await tx.warehouseReceipt.count({ where: filteredWhere });
        return {
          items: rows.map(({ _count, ...row }) => {
            const p = progress.find((p) => p.receipt_id === row.id);
            return {
              ...row,
              id: String(row.id),
              warehouseId:
                row.warehouseId === null ? null : String(row.warehouseId),
              documentDate:
                row.documentDate?.toISOString().slice(0, 10) ?? null,
              createdAt: row.createdAt.toISOString(),
              receivedAt: row.receivedAt.toISOString(),
              placedAt: row.placedAt?.toISOString() ?? null,
              totalQuantity: p?.expected_quantity.toString() ?? '0',
              placedQuantity: p?.placed_quantity.toString() ?? '0',
              lineCount: _count.lines,
              placedLineCount: Number(p?.completed ?? 0),
              unmappedLineCount: Number(p?.unmapped_items ?? 0),
              hasReconciliationCandidates: hints.has(row.id),
              hasProblems:
                !!row.conflict ||
                row.warehouseId === null ||
                Number(p?.unmapped ?? 0) > 0,
            };
          }),
          total,
          page: q.page,
          limit: q.limit,
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }
}
