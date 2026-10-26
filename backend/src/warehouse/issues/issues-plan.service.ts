import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { WarehouseStockService } from '../stock/stock.service';
import { WarehouseReservationsService } from '../reservations/reservations.service';
import { planReservationConsumption } from '../reservations/reservation-consumption';
import type { IssueInput } from './issues.validation';
import { issueConflict } from './issues.model';

@Injectable()
export class WarehouseIssuePlanService {
  constructor(
    private readonly stock: WarehouseStockService,
    private readonly reservations: WarehouseReservationsService,
  ) {}
  async resolveItem(tx: Prisma.TransactionClient, input: IssueInput) {
    const ids = input.positions.map((p) => p.balanceId);
    const balances = await tx.warehouseBalance.findMany({
      where: { id: { in: ids } },
      select: { id: true, itemId: true, storageLocationId: true },
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
    return {
      itemId: balances[0].itemId,
      locationIds: balances.map((b) => String(b.storageLocationId)),
    };
  }
  async build(
    tx: Prisma.TransactionClient,
    input: IssueInput,
    actor: string,
    projectId: bigint | null,
  ) {
    const { itemId, locationIds } = await this.resolveItem(tx, input);
    await this.stock.lockBalances(tx, String(itemId), locationIds);
    const balances = await tx.warehouseBalance.findMany({
      where: { id: { in: input.positions.map((p) => p.balanceId) } },
      include: { item: true, storageLocation: true },
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
    const reservations = await this.reservations.getLocked(
      tx,
      balances.map((b) => b.id),
    );
    const byId = new Map(balances.map((b) => [b.id, b]));
    const positions = input.positions.map((p) => {
      const balance = byId.get(p.balanceId)!;
      return {
        balance,
        quantity: p.quantity,
        reservations: reservations.filter((r) => r.balanceId === p.balanceId),
        changes: planReservationConsumption(
          balance.quantity,
          reservations.filter((r) => r.balanceId === p.balanceId),
          projectId,
          p.quantity,
          input.overrideReservations,
        ),
      };
    });
    const changes = positions.flatMap((p) => p.changes);
    const foreignReservations = changes.filter((c) => !c.own);
    const confirmationToken = createHash('sha256')
      .update(
        JSON.stringify({
          actor,
          type: input.type,
          issueSheetLineId: input.issueSheetLineId?.toString() ?? null,
          itemId: String(itemId),
          projectId: projectId?.toString() ?? null,
          comment: input.comment,
          positions: positions.map((p) => ({
            balanceId: String(p.balance.id),
            physical: p.balance.quantity.toString(),
            quantity: p.quantity.toString(),
            reservations: p.reservations.map((r) => ({
              id: String(r.id),
              projectId: String(r.projectId),
              quantity: r.quantity.toString(),
            })),
          })),
          changes,
        }),
      )
      .digest('hex');
    return {
      itemId,
      positions,
      changes,
      foreignReservations,
      confirmationToken,
    };
  }
}
export type IssuePlan = Awaited<ReturnType<WarehouseIssuePlanService['build']>>;
