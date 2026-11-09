import { ConflictException, NotFoundException } from '@nestjs/common';
import { AuditAction, AuditModule, Prisma } from '@prisma/client';
import { AuditLogService } from '../../audit/audit-log.service';
import { stockId } from '../stock/stock.validation';
export type Tx = Prisma.TransactionClient;
export { assertTransactionPermission as receiptActor } from '../../auth/transaction-permission';
export function receiptConflict(
  code: string,
  message: string,
  details?: Record<string, unknown>,
): never {
  throw new ConflictException({
    code,
    message,
    ...(details ? { details } : {}),
  });
}
export async function lockReceipt(tx: Tx, value: string) {
  const id = stockId(value, 'receiptId');
  const [r] = await tx.$queryRaw<
    { id: bigint }[]
  >`SELECT id FROM warehouse_receipts WHERE id=${id} FOR UPDATE`;
  if (!r)
    throw new NotFoundException({
      code: 'WAREHOUSE_RECEIPT_NOT_FOUND',
      message: 'Приход не найден.',
    });
  return id;
}
export async function placedQuantity(tx: Tx, lineId: bigint) {
  const [r] = await tx.$queryRaw<
    { quantity: Prisma.Decimal }[]
  >`SELECT COALESCE(SUM(p.quantity),0)::numeric AS quantity FROM warehouse_receipt_placements p JOIN warehouse_receipt_lines l ON l.id=p.receipt_line_id WHERE l.id=${lineId} OR l.reconciled_to_line_id=${lineId}`;
  return new Prisma.Decimal(r.quantity);
}
export async function receiptProgress(tx: Tx, id: bigint) {
  const [progress] = await tx.$queryRaw<
    { total: bigint; completed: bigint; started: boolean }[]
  >`SELECT COUNT(*) AS total, COUNT(*) FILTER(WHERE COALESCE(p.quantity,0)>=l.quantity) AS completed, COALESCE(BOOL_OR(COALESCE(p.quantity,0)>0),false) AS started FROM warehouse_receipt_lines l LEFT JOIN LATERAL(SELECT SUM(p.quantity) AS quantity FROM warehouse_receipt_placements p JOIN warehouse_receipt_lines actual ON actual.id=p.receipt_line_id WHERE actual.id=l.id OR actual.reconciled_to_line_id=l.id)p ON TRUE WHERE l.receipt_id=${id}`;
  const status =
    progress.total > 0n && progress.completed === progress.total
      ? 'PLACED'
      : progress.started
        ? 'PLACING'
        : 'RECEIVED';
  const previous = await tx.warehouseReceipt.findUniqueOrThrow({
    where: { id },
    select: { placedAt: true, status: true },
  });
  if (previous.status === 'CANCELLED') return;
  await tx.warehouseReceipt.update({
    where: { id },
    data: {
      status,
      placedAt: status === 'PLACED' ? (previous.placedAt ?? new Date()) : null,
    },
  });
}
export function receiptAudit(
  audit: AuditLogService,
  tx: Tx,
  actor: string,
  id: bigint,
  label: string,
  data: Prisma.InputJsonValue,
  action: AuditAction = AuditAction.UPDATE,
) {
  return audit.writeFieldChanges({
    tx,
    userId: actor,
    module: AuditModule.WAREHOUSE,
    action,
    entityType: 'warehouse_receipt',
    entityStringId: String(id),
    fields: [{ fieldName: label, newValue: data }],
  });
}
