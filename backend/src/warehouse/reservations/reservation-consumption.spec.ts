import { Prisma } from '@prisma/client';
import {
  planReservationConsumption,
  reservationAvailability,
  type ReservationRow,
} from './reservation-consumption';
const d = (v: string) => new Prisma.Decimal(v);
const reserve = (
  id: bigint,
  projectId: bigint,
  quantity: string,
): ReservationRow => ({
  id,
  balanceId: 1n,
  projectId,
  quantity: d(quantity),
  project: { projectNumber: String(projectId), name: null },
});
const reservations = [reserve(1n, 1n, '50'), reserve(2n, 2n, '20')];
describe('Reservation consumption for Issues', () => {
  it.each([
    [null, '30'],
    [1n, '80'],
    [2n, '50'],
  ] as const)('computes availability for project %s', (project, expected) => {
    expect(
      reservationAvailability(
        d('100'),
        reservations,
        project,
      ).available.toString(),
    ).toBe(expected);
  });
  it('uses own reservation before free quantity and deletes an exhausted reserve', () => {
    const rows = [reserve(1n, 1n, '20')];
    expect(
      planReservationConsumption(d('50'), rows, 1n, d('25'), false),
    ).toMatchObject([{ quantity: '20', after: '0', own: true }]);
  });
  it('uses only actually needed foreign reserves in deterministic order', () => {
    const rows = [reserve(2n, 2n, '20'), reserve(1n, 1n, '50')];
    expect(
      planReservationConsumption(d('100'), rows, null, d('45'), true),
    ).toMatchObject([
      { reservationId: '1', quantity: '15', after: '35', own: false },
    ]);
  });
  it('clamps availability during a pre-existing reservation deficit', () => {
    expect(
      reservationAvailability(d('10'), reservations, null).available.toString(),
    ).toBe('0');
    expect(
      planReservationConsumption(
        d('10'),
        [reserve(1n, 1n, '50')],
        1n,
        d('5'),
        false,
      ),
    ).toMatchObject([{ quantity: '5', own: true }]);
  });
  it('does not allow ordinary issues to touch foreign reservations or exceed physical stock', () => {
    expect(() =>
      planReservationConsumption(d('100'), reservations, null, d('31'), false),
    ).toThrow();
    expect(() =>
      planReservationConsumption(d('100'), reservations, 1n, d('101'), true),
    ).toThrow();
  });
});
