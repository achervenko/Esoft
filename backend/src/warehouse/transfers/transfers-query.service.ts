import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { stockId } from '../stock/stock.validation';
import { parseTransferQuery } from './transfers.validation';
import { transferDto } from './transfers.dto';
@Injectable()
export class WarehouseTransfersQueryService {
  constructor(private readonly prisma: PrismaService) {}
  async findOne(value: string) {
    const row = await this.prisma.warehouseTransfer.findUnique({
      where: { id: stockId(value, 'id') },
    });
    if (!row)
      throw new NotFoundException({
        code: 'WAREHOUSE_TRANSFER_NOT_FOUND',
        message: 'Перемещение не найдено.',
      });
    return transferDto(row);
  }
  list(value: unknown) {
    const q = parseTransferQuery(value);
    const where: Prisma.WarehouseTransferWhereInput = {
      itemId: q.itemId,
      fromLocationId: q.fromLocationId,
      toLocationId: q.toLocationId,
      ...(q.warehouseId === undefined
        ? {}
        : {
            OR: [
              { fromLocation: { warehouseId: q.warehouseId } },
              { toLocation: { warehouseId: q.warehouseId } },
            ],
          }),
    };
    return this.prisma.$transaction(
      async (tx) => ({
        items: (
          await tx.warehouseTransfer.findMany({
            where,
            orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
            skip: (q.page - 1) * q.limit,
            take: q.limit,
          })
        ).map(transferDto),
        total: await tx.warehouseTransfer.count({ where }),
        page: q.page,
        limit: q.limit,
      }),
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }
}
