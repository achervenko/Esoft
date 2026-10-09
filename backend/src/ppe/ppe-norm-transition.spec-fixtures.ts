import { Prisma, type PpeIssue, type PpeNormItem } from '@prisma/client';

import { PpeNormTransitionService } from './ppe-norm-transition.service';

import { PpeIssueScheduleService } from './ppe-issue-schedule.service';

import { PpeNormPositionService } from './ppe-norm-position.service';

import { PpeNormIntervalTransitionService } from './ppe-norm-interval-transition.service';
import { PpeNormMonthlyTransitionService } from './ppe-norm-monthly-transition.service';

const interval = new PpeNormIntervalTransitionService();

export const policy = new PpeNormTransitionService(
  new PpeIssueScheduleService(),
  new PpeNormPositionService(),
  interval,
  new PpeNormMonthlyTransitionService(interval),
);

export const date = (s: string) => new Date(`${s}T00:00:00Z`);

export function norm(
  id = 1,
  mode = 'SOFT',
  from = '2026-01-01',
  quantity = 1,
  calculationMode = 'INTERVAL',
  previousNormId: number | null = null,
) {
  return {
    id,
    positionId: 1,
    effectiveFrom: date(from),
    effectiveTo: null as Date | null,
    previousNormId,
    transitionMode: mode,
    items: [
      {
        id,
        normId: id,
        ppeItemId: 1,
        quantity: new Prisma.Decimal(quantity),
        periodCount: 1,
        periodUnit: 'YEAR',
        ppeUnitSnapshot: 'пары',
        ppeItemTypeSnapshot: 'FEET',
        ppeNameSnapshot: 'СИЗ',
        calculationMode,
      } as PpeNormItem,
    ],
  };
}

export function issue(
  normItemId = 1,
  issuedAt = '2026-01-01',
  quantity = 1,
  patch: Partial<PpeIssue> = {},
) {
  return {
    id: normItemId,
    normItemId,
    issueType: 'REGULAR',
    status: 'ISSUED',
    quantity: new Prisma.Decimal(quantity),
    issuedAt: date(issuedAt),
    scheduledAt: date(issuedAt),
    scheduledPortion: 0,
    ...patch,
  } as PpeIssue;
}

export function run(
  mode: string,
  history: PpeIssue[],
  calculationMode = 'INTERVAL',
  oldQuantity = 1,
  newQuantity = 2,
  on = '2026-10-07',
) {
  const old = norm(1, 'SOFT', '2026-01-01', oldQuantity, calculationMode);
  const next = norm(2, mode, '2026-10-07', newQuantity, calculationMode, 1);
  return policy.evaluate(
    new Map([
      [1, old],
      [2, next],
    ]),
    next,
    next.items[0],
    date(on),
    history,
  );
}
