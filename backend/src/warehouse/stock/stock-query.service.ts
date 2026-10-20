import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { stockError } from './stock.errors';
import { assertStockTransaction } from './stock-locks';
import { balanceDto, balanceSelect, type BalanceFilters } from './stock.types';
import { parseBalanceFilters, stockId } from './stock.validation';

@Injectable()
export class WarehouseStockQueryService {
  constructor(private readonly prisma: PrismaService) {}

  async getBalances(filters?: BalanceFilters, tx?: Prisma.TransactionClient) {
    if (tx) assertStockTransaction(tx);
    const query = parseBalanceFilters(filters);
    const quantity: Prisma.DecimalFilter = {
      ...(query.quantityState === 'POSITIVE' ? { gt: 0 } : {}),
      ...(query.quantityState === 'ZERO' ? { equals: 0 } : {}),
      ...(query.min !== undefined ? { gte: query.min } : {}),
      ...(query.max !== undefined ? { lte: query.max } : {}),
    };
    const where: Prisma.WarehouseBalanceWhereInput = {
      itemId: query.itemIds ? { in: query.itemIds } : undefined,
      storageLocationId: query.locationIds
        ? { in: query.locationIds }
        : undefined,
      item:
        query.itemActive === undefined
          ? undefined
          : { isActive: query.itemActive },
      storageLocation:
        query.locationActive === undefined
          ? undefined
          : { isActive: query.locationActive },
      quantity,
    };
    const order: Prisma.WarehouseBalanceOrderByWithRelationInput =
      query.sortBy === 'quantity'
        ? { quantity: query.sortOrder }
        : query.sortBy === 'location'
          ? { storageLocation: { code: query.sortOrder } }
          : { item: { article: query.sortOrder } };
    const read = async (client: Prisma.TransactionClient) => {
      const items = await client.warehouseBalance.findMany({
        where,
        select: balanceSelect,
        orderBy: [order, { id: 'asc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      });
      const total = await client.warehouseBalance.count({ where });
      return {
        items: items.map(balanceDto),
        total,
        page: query.page,
        limit: query.limit,
      };
    };
    return tx
      ? read(tx)
      : this.prisma.$transaction(read, {
          isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
        });
  }

  async getBalance(
    itemId: string,
    locationId: string,
    tx?: Prisma.TransactionClient,
  ) {
    if (tx) assertStockTransaction(tx);
    const row = await (tx ?? this.prisma).warehouseBalance.findUnique({
      where: {
        itemId_storageLocationId: {
          itemId: stockId(itemId, 'itemId'),
          storageLocationId: stockId(locationId, 'locationId'),
        },
      },
      select: balanceSelect,
    });
    return row ? balanceDto(row) : null;
  }

  async getItemTotal(itemId: string, tx?: Prisma.TransactionClient) {
    if (tx) assertStockTransaction(tx);
    const id = stockId(itemId, 'itemId');
    const read = async (client: Prisma.TransactionClient) => {
      if (
        !(await client.warehouseItem.findUnique({
          where: { id },
          select: { id: true },
        }))
      )
        stockError(
          404,
          'WAREHOUSE_ITEM_NOT_FOUND',
          'Номенклатура не найдена.',
          { itemId },
        );
      const result = await client.warehouseBalance.aggregate({
        where: { itemId: id },
        _sum: { quantity: true },
      });
      return result._sum.quantity?.toString() ?? '0';
    };
    return tx
      ? read(tx)
      : this.prisma.$transaction(read, {
          isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
        });
  }
}
