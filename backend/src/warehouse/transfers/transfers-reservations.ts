import { ConflictException } from '@nestjs/common';
import { AuditAction, AuditModule, Prisma } from '@prisma/client';
import { AuditLogService } from '../../audit/audit-log.service';
import { MAX_STOCK_QUANTITY } from '../stock/stock.validation';
import type { ReservationRow } from '../reservations/reservation-consumption';
export function planReservationTransfer(
  rows: ReservationRow[],
  sourceId: bigint,
  targetId: bigint | undefined,
  physical: string,
  quantity: string,
  projectId: string | null,
) {
  const sourceRows = rows.filter((r) => r.balanceId === sourceId);
  const reserved = sourceRows.reduce(
    (sum, r) => sum.plus(r.quantity),
    new Prisma.Decimal(0),
  );
  const amount = new Prisma.Decimal(quantity);
  const own =
    projectId === null
      ? undefined
      : sourceRows.find((r) => String(r.projectId) === projectId);
  const available = Prisma.Decimal.max(
    new Prisma.Decimal(physical).minus(reserved).plus(own?.quantity ?? 0),
    0,
  );
  if (projectId !== null && (!own || own.quantity.lt(amount)))
    throw new ConflictException({
      code: 'WAREHOUSE_TRANSFER_RESERVATION_INSUFFICIENT',
      message: 'Недостаточно резерва выбранного проекта на исходном месте.',
    });
  if (amount.gt(available))
    throw new ConflictException({
      code: 'WAREHOUSE_TRANSFER_RESERVED_STOCK',
      message: 'Недостаточно доступного остатка для перемещения.',
      details: {
        physical,
        reserved: reserved.toString(),
        available: available.toString(),
        requested: quantity,
      },
    });
  if (!own) return null;
  const target = rows.find(
    (r) => r.balanceId === targetId && r.projectId === own.projectId,
  );
  const targetAfter = (target?.quantity ?? new Prisma.Decimal(0)).plus(amount);
  if (targetAfter.gt(MAX_STOCK_QUANTITY))
    throw new ConflictException({
      code: 'WAREHOUSE_TRANSFER_RESERVATION_OVERFLOW',
      message: 'Превышено допустимое количество целевого резерва.',
    });
  return {
    source: own,
    target,
    sourceAfter: own.quantity.minus(amount),
    targetAfter,
    amount,
  };
}
export async function applyReservationTransfer(
  tx: Prisma.TransactionClient,
  plan: NonNullable<ReturnType<typeof planReservationTransfer>>,
  targetBalanceId: bigint,
) {
  if (plan.sourceAfter.isZero())
    await tx.warehouseProjectReservation.delete({
      where: { id: plan.source.id },
    });
  else
    await tx.warehouseProjectReservation.update({
      where: { id: plan.source.id },
      data: { quantity: plan.sourceAfter },
    });
  const target = await tx.warehouseProjectReservation.upsert({
    where: {
      balanceId_projectId: {
        balanceId: targetBalanceId,
        projectId: plan.source.projectId,
      },
    },
    create: {
      balanceId: targetBalanceId,
      projectId: plan.source.projectId,
      quantity: plan.targetAfter,
    },
    update: { quantity: plan.targetAfter },
  });
  return {
    projectId: String(plan.source.projectId),
    projectNumber: plan.source.project.projectNumber,
    projectName: plan.source.project.name,
    quantity: plan.amount.toString(),
    from: {
      reservationId: String(plan.source.id),
      balanceId: String(plan.source.balanceId),
      before: plan.source.quantity.toString(),
      after: plan.sourceAfter.toString(),
    },
    to: {
      reservationId: String(target.id),
      balanceId: String(targetBalanceId),
      before: plan.target?.quantity.toString() ?? '0',
      after: target.quantity.toString(),
    },
  };
}
export async function auditReservationTransfer(
  tx: Prisma.TransactionClient,
  audit: AuditLogService,
  actor: string,
  transferId: bigint,
  change: Awaited<ReturnType<typeof applyReservationTransfer>>,
) {
  for (const [side, row] of [
    ['from', change.from],
    ['to', change.to],
  ] as const)
    await audit.writeFieldChanges({
      tx,
      userId: actor,
      module: AuditModule.WAREHOUSE,
      entityType: 'warehouse_project_reservation',
      entityStringId: row.reservationId,
      action:
        side === 'from'
          ? row.after === '0'
            ? AuditAction.DELETE
            : AuditAction.UPDATE
          : row.before === '0'
            ? AuditAction.CREATE
            : AuditAction.UPDATE,
      fields: [
        {
          fieldName: 'Перенос резерва',
          oldValue: row.before,
          newValue: {
            transferId: String(transferId),
            projectId: change.projectId,
            quantity: change.quantity,
            balanceId: row.balanceId,
            after: row.after,
          },
        },
      ],
    });
}
