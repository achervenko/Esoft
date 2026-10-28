import { ConflictException } from '@nestjs/common';
import assert from 'node:assert/strict';
import { Prisma } from '@prisma/client';
import { planReservationTransfer } from './transfers-reservations';
import type { ReservationRow } from '../reservations/reservation-consumption';
const row = (balanceId: bigint, quantity: string): ReservationRow => ({
  id: balanceId,
  balanceId,
  projectId: 1n,
  quantity: new Prisma.Decimal(quantity),
  project: { projectNumber: 'P', name: null },
});
describe('Reservation transfer capacity', () => {
  it('rejects a target reservation overflow before any mutation', () => {
    assert.throws(
      () =>
        planReservationTransfer(
          [row(1n, '2'), row(2n, '99999999999.999')],
          1n,
          2n,
          '2',
          '0.001',
          '1',
        ),
      (error: unknown) => {
        if (!(error instanceof ConflictException)) return false;
        expect(error.getResponse()).toMatchObject({
          code: 'WAREHOUSE_TRANSFER_RESERVATION_OVERFLOW',
        });
        return true;
      },
    );
  });
  it('keeps decimal transfer exact at the target limit', () => {
    const plan = planReservationTransfer(
      [row(1n, '0.001'), row(2n, '99999999999.998')],
      1n,
      2n,
      '0.001',
      '0.001',
      '1',
    );
    expect(plan?.targetAfter.toString()).toBe('99999999999.999');
    expect(plan?.sourceAfter.toString()).toBe('0');
  });
});
