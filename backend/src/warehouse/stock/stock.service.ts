import { Injectable } from '@nestjs/common';
import { AuditAction, AuditModule, Prisma } from '@prisma/client';
import { AuditLogService } from '../../audit/audit-log.service';
import { stockError } from './stock.errors';
import { assertStockTransaction, lockStockBalances } from './stock-locks';
import { WarehouseStockQueryService } from './stock-query.service';
import {
  balanceDto,
  balanceSelect,
  type BalanceFilters,
  type StockBalance,
  type StockMutationContext,
  type StockQuantity,
} from './stock.types';
import { MAX_STOCK_QUANTITY, stockId, stockQuantity } from './stock.validation';

@Injectable()
export class WarehouseStockService {
  constructor(
    private readonly queries: WarehouseStockQueryService,
    private readonly audit: AuditLogService,
  ) {}

  getBalances(filters?: BalanceFilters, tx?: Prisma.TransactionClient) {
    return this.queries.getBalances(filters, tx);
  }

  getBalance(
    itemId: string,
    locationId: string,
    tx?: Prisma.TransactionClient,
  ) {
    return this.queries.getBalance(itemId, locationId, tx);
  }

  getItemTotal(itemId: string, tx?: Prisma.TransactionClient) {
    return this.queries.getItemTotal(itemId, tx);
  }

  // Call once for the full set of locations BEFORE checking/updating reservations.
  // Locks remain held until the caller's transaction finishes.
  async lockBalances(
    tx: Prisma.TransactionClient,
    itemId: string,
    locationIds: string[],
  ) {
    await lockStockBalances(tx, itemId, locationIds);
  }

  async receiveStock(
    context: StockMutationContext,
    itemId: string,
    locationId: string,
    value: StockQuantity,
  ) {
    this.assertContext(context);
    const quantity = stockQuantity(value);
    const locked = await lockStockBalances(context.tx, itemId, [locationId]);
    const targetId = locked.locationIds[0];
    const previous = locked.balances.get(targetId);
    const next = (previous?.quantity ?? new Prisma.Decimal(0)).plus(quantity);
    this.assertCapacity(next, itemId, locationId);
    return balanceDto(
      await this.writeBalance(context, locked.itemId, targetId, previous, next),
    );
  }

  async issueStock(
    context: StockMutationContext,
    itemId: string,
    locationId: string,
    value: StockQuantity,
  ) {
    this.assertContext(context);
    const quantity = stockQuantity(value);
    const locked = await lockStockBalances(context.tx, itemId, [locationId]);
    const sourceId = locked.locationIds[0];
    const previous = this.requireSource(
      locked.balances.get(sourceId),
      itemId,
      locationId,
      quantity,
    );
    return balanceDto(
      await this.writeBalance(
        context,
        locked.itemId,
        sourceId,
        previous,
        previous.quantity.minus(quantity),
      ),
    );
  }

  async moveStock(
    context: StockMutationContext,
    itemId: string,
    fromLocationId: string,
    toLocationId: string,
    value: StockQuantity,
  ) {
    this.assertContext(context);
    const quantity = stockQuantity(value);
    const fromId = stockId(fromLocationId, 'fromLocationId');
    const toId = stockId(toLocationId, 'toLocationId');
    if (fromId === toId)
      stockError(
        400,
        'WAREHOUSE_STOCK_SAME_LOCATION',
        'Исходное и целевое места должны различаться.',
      );
    const locked = await lockStockBalances(context.tx, itemId, [
      fromLocationId,
      toLocationId,
    ]);
    const source = this.requireSource(
      locked.balances.get(fromId),
      itemId,
      fromLocationId,
      quantity,
    );
    const destination = locked.balances.get(toId);
    const destinationQuantity = (
      destination?.quantity ?? new Prisma.Decimal(0)
    ).plus(quantity);
    this.assertCapacity(destinationQuantity, itemId, toLocationId);
    const from = await this.writeBalance(
      context,
      locked.itemId,
      fromId,
      source,
      source.quantity.minus(quantity),
    );
    const to = await this.writeBalance(
      context,
      locked.itemId,
      toId,
      destination,
      destinationQuantity,
    );
    return { from: balanceDto(from), to: balanceDto(to) };
  }

  private assertContext(context: StockMutationContext) {
    assertStockTransaction(context?.tx);
    if (typeof context.actorUserId !== 'string' || !context.actorUserId.trim())
      stockError(
        400,
        'WAREHOUSE_STOCK_ACTOR_REQUIRED',
        'Укажите пользователя операции для аудита.',
      );
  }

  private requireSource(
    previous: StockBalance | undefined,
    itemId: string,
    locationId: string,
    requested: Prisma.Decimal,
  ) {
    if (!previous)
      stockError(
        404,
        'WAREHOUSE_BALANCE_NOT_FOUND',
        'Запись остатка не найдена.',
        { itemId, locationId },
      );
    if (previous.quantity.lt(requested))
      stockError(
        409,
        'WAREHOUSE_STOCK_INSUFFICIENT',
        'Недостаточно физического остатка.',
        {
          itemId,
          locationId,
          requested: requested.toString(),
          available: previous.quantity.toString(),
        },
      );
    return previous;
  }

  private assertCapacity(
    quantity: Prisma.Decimal,
    itemId: string,
    locationId: string,
  ) {
    if (quantity.gt(MAX_STOCK_QUANTITY))
      stockError(
        409,
        'WAREHOUSE_STOCK_QUANTITY_OVERFLOW',
        'Превышено допустимое количество остатка.',
        {
          itemId,
          locationId,
          maximum: MAX_STOCK_QUANTITY.toString(),
        },
      );
  }

  private async writeBalance(
    { tx, actorUserId }: StockMutationContext,
    itemId: bigint,
    storageLocationId: bigint,
    previous: StockBalance | undefined,
    quantity: Prisma.Decimal,
  ) {
    const next = previous
      ? await tx.warehouseBalance.update({
          where: { id: previous.id },
          data: { quantity },
          select: balanceSelect,
        })
      : await tx.warehouseBalance.create({
          data: { itemId, storageLocationId, quantity },
          select: balanceSelect,
        });
    await this.audit.writeFieldChanges({
      tx,
      userId: actorUserId,
      module: AuditModule.WAREHOUSE,
      entityType: 'warehouse_balance',
      entityStringId: next.id.toString(),
      action: previous ? AuditAction.UPDATE : AuditAction.CREATE,
      fields: [
        {
          fieldName: 'Физический остаток',
          oldValue: previous?.quantity.toString(),
          newValue: next.quantity.toString(),
        },
      ],
    });
    return next;
  }
}
