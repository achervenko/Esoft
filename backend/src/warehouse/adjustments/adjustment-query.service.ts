import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { stockId } from '../stock/stock.validation';
import { WarehouseStockAdjustmentAccessService } from './adjustment-access.service';
import { adjustmentInclude, toAdjustmentDto } from './adjustments.mapper';
import { parseAdjustmentQuery } from './adjustments.validation';

@Injectable()
export class WarehouseStockAdjustmentQueryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: WarehouseStockAdjustmentAccessService,
  ) {}

  async get(idValue: string, actorUserId: string) {
    const id = stockId(idValue, 'adjustmentId');
    return this.prisma.$transaction(async (tx) => {
      await this.access.assertAdmin(tx, actorUserId);
      const row = await tx.warehouseStockAdjustment.findUnique({
        where: { id },
        include: adjustmentInclude,
      });
      if (!row)
        throw new NotFoundException({
          code: 'WAREHOUSE_ADJUSTMENT_NOT_FOUND',
          message: 'Корректировка не найдена.',
        });
      return toAdjustmentDto(row);
    });
  }

  async list(value: unknown, actorUserId: string) {
    const query = parseAdjustmentQuery(value);
    const where: Prisma.WarehouseStockAdjustmentWhereInput = {
      type: query.type,
      balance: { itemId: query.itemId, storageLocationId: query.locationId },
    };
    return this.prisma.$transaction(
      async (tx) => {
        await this.access.assertAdmin(tx, actorUserId);
        const items = await tx.warehouseStockAdjustment.findMany({
          where,
          include: adjustmentInclude,
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          skip: (query.page - 1) * query.limit,
          take: query.limit,
        });
        return {
          items: items.map(toAdjustmentDto),
          total: await tx.warehouseStockAdjustment.count({ where }),
          page: query.page,
          limit: query.limit,
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }
}
