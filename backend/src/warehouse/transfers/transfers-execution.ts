import { ConflictException, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { AuditLogService } from '../../audit/audit-log.service';
import type { WarehouseStockService } from '../stock/stock.service';
import { lockWarehouse } from '../storage-structure/storage-structure.policy';
import {
  locationWithWarehouseSelect,
  locationWithWarehouseDto,
} from '../storage-structure/storage-structure.dto';
import { warehouseItemIdentityDto } from '../catalog/catalog.dto';
import {
  readReservation,
  reservationOrderDto,
  reservationOrderSelect,
} from '../reservations/reservations.dto';
import { stockError } from '../stock/stock.errors';
import type { MoveReservationInput } from '../reservations/reservation-move';
import type { WarehouseReservationManager } from '../reservations/reservation-manager.service';
import { applyTransferDistribution } from './transfers-distribution';
import type { parseTransfer } from './transfers.validation';
export type ReservedTransfer = {
  reservationId: string;
  manager: WarehouseReservationManager;
};
type Input = ReturnType<typeof parseTransfer>;
async function lockTransferReferences(
  tx: Prisma.TransactionClient,
  stock: WarehouseStockService,
  input: Input,
) {
  const locationIds = [
    BigInt(input.fromLocationId),
    BigInt(input.toLocationId),
  ];
  const references = await tx.warehouseStorageLocation.findMany({
    where: { id: { in: locationIds } },
    select: { warehouseId: true },
  });
  for (const id of [...new Set(references.map((r) => r.warehouseId))].sort(
    (a, b) => (a < b ? -1 : a > b ? 1 : 0),
  ))
    await lockWarehouse(tx, id, true);
  await stock.lockBalances(tx, input.itemId, [
    input.fromLocationId,
    input.toLocationId,
  ]);
  const locations = await tx.warehouseStorageLocation.findMany({
    where: { id: { in: locationIds } },
    select: locationWithWarehouseSelect,
  });
  const item = await tx.warehouseItem.findUniqueOrThrow({
    where: { id: BigInt(input.itemId) },
  });
  if (!item.isActive || locations.some((l) => !l.isActive))
    throw new ConflictException({
      code: 'WAREHOUSE_TRANSFER_INACTIVE_REFERENCE',
      message: 'Номенклатура или место неактивны.',
    });
  const from = locations.find((l) => String(l.id) === input.fromLocationId);
  const to = locations.find((l) => String(l.id) === input.toLocationId);
  if (!from || !to)
    throw new NotFoundException({
      code: 'WAREHOUSE_LOCATION_NOT_FOUND',
      message: 'Место хранения не найдено.',
    });
  return { item, from, to };
}
export async function prepareTransferExecution(
  tx: Prisma.TransactionClient,
  stock: WarehouseStockService,
  input: Input,
  reserved?: ReservedTransfer,
) {
  const reservation = reserved
    ? await tx.warehouseReservation.findUnique({
        where: { id: reserved.reservationId },
        include: { order: { select: reservationOrderSelect } },
      })
    : null;
  if (reserved && (!reservation || String(reservation.itemId) !== input.itemId))
    stockError(404, 'WAREHOUSE_RESERVATION_NOT_FOUND', 'Резерв не найден.');
  const { item, from, to } = await lockTransferReferences(tx, stock, input);
  const balance = await stock.getBalance(
    input.itemId,
    input.fromLocationId,
    tx,
  );
  if (!balance)
    throw new NotFoundException({
      code: 'WAREHOUSE_BALANCE_NOT_FOUND',
      message: 'Исходный остаток не найден.',
    });
  const destinationBefore = await stock.getBalance(
    input.itemId,
    input.toLocationId,
    tx,
  );
  return { reservation, item, from, to, balance, destinationBefore };
}
export async function executeTransfer(
  tx: Prisma.TransactionClient,
  stock: WarehouseStockService,
  audit: AuditLogService,
  input: Input,
  actor: string,
  prepared: Awaited<ReturnType<typeof prepareTransferExecution>>,
  reserved?: ReservedTransfer,
) {
  const { reservation, item, from, to, balance, destinationBefore } = prepared;
  let distributionSnapshot:
    Awaited<ReturnType<typeof applyTransferDistribution>> | undefined;
  if (input.distribution) {
    if (reserved)
      stockError(
        400,
        'WAREHOUSE_TRANSFER_INVALID',
        'Нельзя совместить два режима перемещения.',
      );
    distributionSnapshot = await applyTransferDistribution(
      tx,
      stock,
      audit,
      input,
      actor,
    );
  }
  if (reserved) {
    const command: MoveReservationInput = {
      reservationId: reserved.reservationId,
      ...input,
    };
    await reserved.manager.move(
      { tx, actorUserId: actor, comment: input.comment ?? undefined },
      command,
    );
  }
  const moved =
    reserved || input.distribution
      ? {
          from: await stock.getBalance(input.itemId, input.fromLocationId, tx),
          to: await stock.getBalance(input.itemId, input.toLocationId, tx),
        }
      : await stock.moveStock(
          { tx, actorUserId: actor },
          input.itemId,
          input.fromLocationId,
          input.toLocationId,
          input.quantity,
        );
  const snapshot = {
    ...(distributionSnapshot ? { distribution: distributionSnapshot } : {}),
    item: warehouseItemIdentityDto(item),
    from: locationWithWarehouseDto(from),
    to: locationWithWarehouseDto(to),
    fromQuantityBefore: balance.quantity,
    fromQuantityAfter: moved.from!.quantity,
    toQuantityBefore: destinationBefore?.quantity ?? '0',
    toQuantityAfter: moved.to!.quantity,
    ...(reserved && reservation
      ? {
          reservationId: reserved.reservationId,
          order: reservationOrderDto(reservation.order),
          reservationResult: await readReservation(tx, reserved.reservationId),
        }
      : {}),
  };
  return snapshot;
}
