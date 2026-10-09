import { Injectable } from '@nestjs/common';
import type { PpeIssue, PpeNormItem } from '@prisma/client';
import type { IssueSchedule } from './ppe-issue-schedule.service';
import type { NormItemChain, PositionNorm } from './ppe-norm-position.service';
import {
  DAY,
  addMonths,
  maxDate,
  monthStart,
} from './ppe-norm-transition.dates';

function intervalEnd(date: Date, item: PpeNormItem) {
  const months = item.periodCount * (item.periodUnit === 'YEAR' ? 12 : 1);
  const quantity = item.quantity.toNumber();
  const portions =
    item.ppeUnitSnapshot !== 'мл' && Number.isInteger(quantity) ? quantity : 1;
  return months % portions === 0
    ? addMonths(date, months / portions)
    : new Date(
        date.getTime() +
          Math.max(
            1,
            Math.floor(
              (addMonths(date, months).getTime() - date.getTime()) /
                portions /
                DAY,
            ),
          ) *
            DAY,
      );
}

@Injectable()
export class PpeNormIntervalTransitionService {
  evaluate(
    chain: NormItemChain,
    norm: PositionNorm,
    item: PpeNormItem,
    on: Date,
    history: PpeIssue[],
  ) {
    const last = history.at(-1);
    const due = this.deadline(chain, last);
    const quantity =
      item.ppeUnitSnapshot !== 'мл' &&
      Number.isInteger(item.quantity.toNumber())
        ? 1
        : item.quantity.toNumber();
    const inside = !norm.effectiveTo || due <= norm.effectiveTo;
    const available =
      inside && due <= on ? { index: 0, scheduledAt: due, quantity } : null;
    const state: IssueSchedule = {
      cycleFrom: due,
      cycleTo: new Date(
        Math.min(
          intervalEnd(due, item).getTime() - DAY,
          norm.effectiveTo?.getTime() ?? Infinity,
        ),
      ),
      totalPortions: 1,
      duePortions: available ? 1 : 0,
      fulfilledPortions: 0,
      dueUnissued: available ? 1 : 0,
      overdue: available && due < on ? 1 : 0,
      available,
      nextFuture:
        inside && due > on ? { index: 0, scheduledAt: due, quantity } : null,
    };
    return {
      state,
      fulfilled: history.filter((issue) => issue.normItemId === item.id),
    };
  }

  deadline(chain: NormItemChain, last?: PpeIssue): Date {
    const [{ norm, item }, ...ancestors] = chain;
    if (!last) return norm.effectiveFrom;
    const previous = ancestors[0];
    if (
      last.normItemId === item.id ||
      norm.transitionMode === 'HARD' ||
      !previous
    ) {
      const end =
        item.calculationMode === 'MONTHLY'
          ? addMonths(monthStart(last.issuedAt), 1)
          : intervalEnd(last.issuedAt, item);
      return maxDate(norm.effectiveFrom, end);
    }
    return maxDate(
      norm.effectiveFrom,
      this.deadline([previous, ...ancestors.slice(1)], last),
    );
  }
}
