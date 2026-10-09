import { Injectable } from '@nestjs/common';
import { Prisma, type PpeIssue, type PpeNormItem } from '@prisma/client';
import type { IssueSchedule } from './ppe-issue-schedule.service';
import type { NormItemChain, PositionNorm } from './ppe-norm-position.service';
import { PpeNormIntervalTransitionService } from './ppe-norm-interval-transition.service';
import { addMonths, maxDate, monthStart } from './ppe-norm-transition.dates';

@Injectable()
export class PpeNormMonthlyTransitionService {
  constructor(private readonly interval: PpeNormIntervalTransitionService) {}

  evaluate(
    chain: NormItemChain,
    norm: PositionNorm,
    item: PpeNormItem,
    on: Date,
    history: PpeIssue[],
  ) {
    // Only pre-transition issues determine soft activation. Later issues must
    // never move the activation date and change already-issued monthly keys.
    const prior = history
      .filter(
        (issue) =>
          issue.normItemId !== item.id && issue.issuedAt < norm.effectiveFrom,
      )
      .at(-1);
    const previous = chain[1];
    const ancestors: NormItemChain | null = previous
      ? [previous, ...chain.slice(2)]
      : null;
    const activation =
      norm.transitionMode === 'SOFT' && prior && ancestors
        ? maxDate(norm.effectiveFrom, this.interval.deadline(ancestors, prior))
        : norm.effectiveFrom;
    const firstMonth = monthStart(activation);
    const months = item.periodCount * (item.periodUnit === 'YEAR' ? 12 : 1);
    // Whole pieces/pairs stay whole. Fractional volumes keep the database's
    // 0.001 precision; cumulative division preserves the period's exact total.
    const scale =
      item.ppeUnitSnapshot !== 'мл' && item.quantity.isInteger() ? 1 : 1000;
    const units = BigInt(item.quantity.mul(scale).toFixed(0));
    const quantityAt = (offset: number) => {
      const n = BigInt(offset % months),
        m = BigInt(months);
      return Number((units * (n + 1n)) / m - (units * n) / m) / scale;
    };
    const byMonth = new Map<
      number,
      { units: Prisma.Decimal; issues: PpeIssue[] }
    >();
    for (const issue of history) {
      // A late issue under this revision closes its scheduled month, rather
      // than leaving that month permanently due. Ancestors credit the actual
      // transition month, because their old schedules must not be recreated.
      const creditedAt =
        issue.normItemId === item.id
          ? (issue.scheduledAt ?? issue.issuedAt)
          : issue.issuedAt;
      const key = Number(monthStart(creditedAt));
      const group = byMonth.get(key) ?? {
        units: new Prisma.Decimal(0),
        issues: [],
      };
      group.units = group.units.add(issue.quantity);
      group.issues.push(issue);
      byMonth.set(key, group);
    }
    const elapsed = Math.max(
      0,
      (on.getUTCFullYear() - firstMonth.getUTCFullYear()) * 12 +
        on.getUTCMonth() -
        firstMonth.getUTCMonth(),
    );
    let available: IssueSchedule['available'] = null;
    let nextFuture: IssueSchedule['nextFuture'] = null;
    let duePortions = 0,
      fulfilledPortions = 0,
      overdue = 0;
    const fulfilled: PpeIssue[] = [];
    const horizon = Math.min(
      elapsed + months,
      (9999 - firstMonth.getUTCFullYear()) * 12 + 11 - firstMonth.getUTCMonth(),
    );
    for (let offset = 0; offset <= horizon; offset++) {
      const start = addMonths(firstMonth, offset);
      const due = maxDate(start, activation);
      if (norm.effectiveTo && due > norm.effectiveTo) break;
      const target = quantityAt(offset);
      if (target <= 0) continue;
      const group = byMonth.get(Number(start));
      const remaining = Math.max(
        0,
        Number(new Prisma.Decimal(target).sub(group?.units ?? 0).toFixed(3)),
      );
      if (due <= on) {
        duePortions++;
        fulfilled.push(...(group?.issues ?? []));
        if (remaining === 0) fulfilledPortions++;
        else {
          if (due < on) overdue++;
          const used = new Set(
            (group?.issues ?? [])
              .filter((issue) => issue.normItemId === item.id)
              .map((issue) => issue.scheduledPortion),
          );
          let index = 0;
          while (used.has(index)) index++;
          available ??= { index, scheduledAt: due, quantity: remaining };
        }
      } else if (remaining > 0) {
        nextFuture = { index: 0, scheduledAt: due, quantity: remaining };
        break;
      }
    }
    const state: IssueSchedule = {
      cycleFrom: activation,
      cycleTo: norm.effectiveTo,
      totalPortions: duePortions + (nextFuture ? 1 : 0),
      duePortions,
      fulfilledPortions,
      dueUnissued: duePortions - fulfilledPortions,
      overdue,
      available,
      nextFuture,
    };
    return { state, fulfilled };
  }
}
