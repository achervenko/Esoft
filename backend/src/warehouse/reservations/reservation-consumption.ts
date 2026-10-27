import { Prisma } from '@prisma/client';
import { ConflictException } from '@nestjs/common';

function consumptionConflict(code: string, message: string): never {
  throw new ConflictException({ code, message });
}

export type ReservationRow = {
  id: bigint;
  balanceId: bigint;
  projectId: bigint;
  quantity: Prisma.Decimal;
  project: { projectNumber: string; name: string | null };
};
export type ReservationUse = {
  reservationId: string;
  balanceId: string;
  projectId: string;
  projectNumber: string;
  projectName: string | null;
  before: string;
  after: string;
  quantity: string;
  own: boolean;
};
export function reservationAvailability(
  physical: Prisma.Decimal,
  reservations: ReservationRow[],
  projectId: bigint | null,
) {
  const own = reservations
    .filter((r) => r.projectId === projectId)
    .reduce((n, r) => n.plus(r.quantity), new Prisma.Decimal(0));
  const reserved = reservations.reduce(
    (n, r) => n.plus(r.quantity),
    new Prisma.Decimal(0),
  );
  const others = reserved.minus(own);
  return {
    reserved,
    own,
    others,
    available: Prisma.Decimal.max(0, physical.minus(others)),
    free: Prisma.Decimal.max(0, physical.minus(reserved)),
  };
}
export function planReservationConsumption(
  physical: Prisma.Decimal,
  reservations: ReservationRow[],
  projectId: bigint | null,
  quantity: Prisma.Decimal,
  override: boolean,
): ReservationUse[] {
  const availability = reservationAvailability(
    physical,
    reservations,
    projectId,
  );
  if (quantity.gt(physical))
    consumptionConflict(
      'WAREHOUSE_ISSUE_INSUFFICIENT_STOCK',
      'Количество превышает физический остаток.',
    );
  if (!override && quantity.gt(availability.available))
    consumptionConflict(
      'WAREHOUSE_ISSUE_RESERVED_STOCK',
      'Количество превышает доступный остаток с учётом резервов.',
    );
  const changes: ReservationUse[] = [];
  let remaining = quantity;
  const consume = (r: ReservationRow, amount: Prisma.Decimal) => {
    if (amount.lte(0)) return;
    changes.push({
      reservationId: String(r.id),
      balanceId: String(r.balanceId),
      projectId: String(r.projectId),
      projectNumber: r.project.projectNumber,
      projectName: r.project.name,
      before: r.quantity.toString(),
      after: r.quantity.minus(amount).toString(),
      quantity: amount.toString(),
      own: r.projectId === projectId,
    });
    remaining = remaining.minus(amount);
  };
  for (const r of reservations.filter((r) => r.projectId === projectId))
    consume(r, Prisma.Decimal.min(r.quantity, remaining));
  remaining = Prisma.Decimal.max(0, remaining.minus(availability.free));
  if (remaining.gt(0) && override) {
    for (const r of reservations
      .filter((r) => r.projectId !== projectId)
      .sort((a, b) => (a.id < b.id ? -1 : 1)))
      consume(r, Prisma.Decimal.min(r.quantity, remaining));
  }
  if (remaining.gt(0))
    consumptionConflict(
      'WAREHOUSE_ISSUE_RESERVED_STOCK',
      'Недостаточно доступного количества.',
    );
  return changes;
}
