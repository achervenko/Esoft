import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { parseReceiptQuery } from './receipts.validation';
@Injectable()
export class WarehouseReceiptsQueryService {
  constructor(private readonly prisma: PrismaService) {}
  list(value: unknown) {
    const q = parseReceiptQuery(value);
    const where: Prisma.WarehouseReceiptWhereInput = {
      warehouseId: q.warehouseId,
      source: q.source,
      createdByUserId: q.createdByUserId,
      createdAt: { gte: q.createdFrom, lte: q.createdTo },
      ...(q.search
        ? {
            documentNumber: {
              contains: q.search.replace(/[\\%_]/g, '\\$&'),
              mode: 'insensitive',
            },
          }
        : {}),
      ...(q.itemId !== undefined || q.storageLocationId !== undefined
        ? {
            lines: {
              some: {
                itemId: q.itemId,
                storageLocationId: q.storageLocationId,
              },
            },
          }
        : {}),
    };
    return this.prisma.$transaction(
      async (tx) => {
        const rows = await tx.warehouseReceipt.findMany({
          where,
          skip: q.offset,
          take: q.limit,
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          select: {
            id: true,
            warehouseId: true,
            source: true,
            documentNumber: true,
            documentDate: true,
            comment: true,
            warehouseCodeSnapshot: true,
            warehouseNameSnapshot: true,
            createdAt: true,
            createdByUserId: true,
            createdBy: { select: { id: true, name: true } },
            _count: { select: { lines: true } },
          },
        });
        const total = await tx.warehouseReceipt.count({ where });
        return {
          items: rows.map(({ _count, ...row }) => ({
            ...row,
            id: String(row.id),
            warehouseId: String(row.warehouseId),
            createdAt: row.createdAt.toISOString(),
            documentDate: row.documentDate?.toISOString().slice(0, 10) ?? null,
            lineCount: _count.lines,
          })),
          total,
          page: q.page,
          limit: q.limit,
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }
}
