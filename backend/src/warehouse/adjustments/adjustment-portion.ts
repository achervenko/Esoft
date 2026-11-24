import { ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { AdjustmentInput } from './adjustments.validation';
export async function assertAdjustmentPortion(
  tx: Prisma.TransactionClient,
  input: AdjustmentInput,
  before: Prisma.Decimal,
) {
  if (!input.portion) return;
  const { reservationId, expectedQuantity, actualQuantity } = input.portion;
  const allocations = await tx.warehouseReservationAllocation.findMany({
    where: {
      locationId: BigInt(input.locationId),
      reservation: { itemId: BigInt(input.itemId) },
    },
  });
  const current = reservationId
    ? (allocations.find((a) => a.reservationId === reservationId)?.quantity ??
      new Prisma.Decimal(0))
    : Prisma.Decimal.max(
        0,
        before.minus(
          allocations.reduce(
            (sum, a) => sum.plus(a.quantity),
            new Prisma.Decimal(0),
          ),
        ),
      );
  if (
    reservationId &&
    !(await tx.warehouseReservation.findFirst({
      where: { id: reservationId, itemId: BigInt(input.itemId) },
    }))
  )
    throw new ConflictException({
      code: 'WAREHOUSE_ADJUSTMENT_RESERVATION_INVALID',
      message: 'Резерв не относится к выбранной номенклатуре.',
    });
  if (
    !current.eq(expectedQuantity) ||
    input.mode !== 'ACTUAL' ||
    !new Prisma.Decimal(actualQuantity)
      .minus(current)
      .eq(new Prisma.Decimal(input.actualQuantity).minus(before))
  )
    throw new ConflictException({
      code: 'WAREHOUSE_ADJUSTMENT_STALE_PORTION',
      message: 'Выбранная часть остатка изменилась. Обновите данные.',
    });
}

export async function resolveShortageAllocations(
  tx: Prisma.TransactionClient,
  input: AdjustmentInput,
  before: Prisma.Decimal,
) {
  if (!input.shortageAllocations) return [];
  if (input.mode !== 'ACTUAL' || !before.gt(input.actualQuantity))
    throw new ConflictException({
      code: 'WAREHOUSE_ADJUSTMENT_SHORTAGE_INVALID',
      message: 'Распределение по резервам допустимо только при недостаче.',
    });
  const allocations = await tx.warehouseReservationAllocation.findMany({
    where: {
      locationId: BigInt(input.locationId),
      reservation: { itemId: BigInt(input.itemId) },
    },
    select: {
      reservationId: true,
      quantity: true,
      reservation: { select: { orderId: true } },
    },
  });
  const covered = allocations.reduce(
    (sum, row) => sum.plus(row.quantity),
    new Prisma.Decimal(0),
  );
  const required = Prisma.Decimal.max(0, covered.minus(input.actualQuantity));
  const total = input.shortageAllocations.reduce(
    (sum, row) => sum.plus(row.quantity),
    new Prisma.Decimal(0),
  );
  const byId = new Map(allocations.map((row) => [row.reservationId, row]));
  const resolved = input.shortageAllocations.map((row) => ({
    row,
    allocation: byId.get(row.reservationId),
  }));
  if (
    total.lt(required) ||
    resolved.some(
      ({ row, allocation }) =>
        !allocation ||
        !allocation.quantity.eq(row.expectedQuantity) ||
        allocation.quantity.lt(row.quantity),
    )
  )
    throw new ConflictException({
      code: 'WAREHOUSE_ADJUSTMENT_STALE_PORTION',
      message:
        'Распределение недостачи не соответствует текущим резервам. Обновите данные.',
    });
  // Reservation locks are acquired in order ID order for the same item.
  return resolved
    .sort((a, b) =>
      a.allocation!.reservation.orderId.localeCompare(
        b.allocation!.reservation.orderId,
      ),
    )
    .map(({ row }) => row);
}
