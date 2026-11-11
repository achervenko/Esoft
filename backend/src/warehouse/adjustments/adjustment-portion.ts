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
