import { lockWarehouse } from '../storage-structure/storage-structure.policy';
import { locationWithWarehouseSelect } from '../storage-structure/storage-structure.dto';
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { WarehouseStockService } from '../stock/stock.service';
import type { IssueInput } from './issues.validation';
import { issueConflict } from './issues.model';

@Injectable()
export class WarehouseIssuePlanService {
  constructor(private readonly stock: WarehouseStockService) {}
  async resolveItem(tx: Prisma.TransactionClient, input: IssueInput) {
    const ids = input.positions.map((p) => p.balanceId);
    const balances = await tx.warehouseBalance.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        itemId: true,
        storageLocationId: true,
        storageLocation: { select: { warehouseId: true } },
      },
    });
    if (balances.length !== ids.length)
      issueConflict(
        'WAREHOUSE_ISSUE_BALANCE_NOT_FOUND',
        'Один из складских остатков не найден.',
      );
    if (new Set(balances.map((b) => String(b.itemId))).size !== 1)
      issueConflict(
        'WAREHOUSE_ISSUE_MULTIPLE_ITEMS',
        'Все позиции выдачи должны относиться к одной номенклатуре.',
      );
    if (
      new Set(balances.map((b) => String(b.storageLocation.warehouseId)))
        .size !== 1
    )
      issueConflict(
        'WAREHOUSE_ISSUE_MULTIPLE_WAREHOUSES',
        'Все места выдачи должны принадлежать одному складу.',
      );
    return {
      warehouseId: balances[0].storageLocation.warehouseId,
      itemId: balances[0].itemId,
      locationIds: balances.map((b) => String(b.storageLocationId)),
    };
  }
  async build(tx: Prisma.TransactionClient, input: IssueInput) {
    const { itemId, locationIds, warehouseId } = await this.resolveItem(
      tx,
      input,
    );
    await lockWarehouse(tx, warehouseId, true);
    await this.stock.lockBalances(tx, String(itemId), locationIds);
    const balances = await tx.warehouseBalance.findMany({
      where: { id: { in: input.positions.map((p) => p.balanceId) } },
      include: {
        item: true,
        storageLocation: { select: locationWithWarehouseSelect },
      },
    });
    if (
      balances.length !== input.positions.length ||
      balances.some(
        (b) =>
          b.itemId !== itemId ||
          !b.item.isActive ||
          !b.storageLocation.isActive,
      )
    )
      issueConflict(
        'WAREHOUSE_ISSUE_BALANCE_UNAVAILABLE',
        'Номенклатура или место хранения недоступны.',
      );
    const byId = new Map(balances.map((b) => [b.id, b]));
    const positions = input.positions.map((p) => ({
      balance: byId.get(p.balanceId)!,
      quantity: p.quantity,
    }));
    return { warehouseId, itemId, positions };
  }
}
export type IssuePlan = Awaited<ReturnType<WarehouseIssuePlanService['build']>>;
