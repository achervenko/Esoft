import { Injectable } from '@nestjs/common';
import { AuditAction, AuditModule, Prisma } from '@prisma/client';
import { AuditLogService } from '../../audit/audit-log.service';
import { assertStockTransaction } from '../stock/stock-locks';
import type { ReservationUse, ReservationRow } from './reservation-consumption';

@Injectable()
export class WarehouseReservationsService {
  constructor(private readonly audit: AuditLogService) {}
  /** Call only after Stock.lockBalances for all affected balances, in both management and Issues. */
  async getLocked(
    tx: Prisma.TransactionClient,
    balanceIds: bigint[],
  ): Promise<ReservationRow[]> {
    assertStockTransaction(tx);
    if (!balanceIds.length) return [];
    await tx.$queryRaw(
      Prisma.sql`SELECT id FROM warehouse_project_reservations WHERE balance_id IN (${Prisma.join(balanceIds)}) ORDER BY balance_id, id FOR UPDATE`,
    );
    return tx.warehouseProjectReservation.findMany({
      where: { balanceId: { in: balanceIds } },
      include: { project: { select: { projectNumber: true, name: true } } },
      orderBy: { id: 'asc' },
    });
  }
  async consume(
    tx: Prisma.TransactionClient,
    changes: ReservationUse[],
    actor: string,
    issueId: bigint,
  ) {
    assertStockTransaction(tx);
    for (const change of changes) {
      const id = BigInt(change.reservationId);
      if (new Prisma.Decimal(change.after).isZero())
        await tx.warehouseProjectReservation.delete({ where: { id } });
      else
        await tx.warehouseProjectReservation.update({
          where: { id },
          data: { quantity: change.after },
        });
      await this.audit.writeFieldChanges({
        tx,
        userId: actor,
        module: AuditModule.WAREHOUSE,
        action: AuditAction.UPDATE,
        entityType: 'warehouse_project_reservation',
        entityStringId: change.reservationId,
        fields: [
          {
            fieldName: 'Расход резерва при выдаче',
            oldValue: change.before,
            newValue: { ...change, issueId: String(issueId) },
          },
        ],
      });
    }
  }
}
