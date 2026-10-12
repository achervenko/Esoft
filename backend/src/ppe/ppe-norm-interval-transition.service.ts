import { Injectable } from '@nestjs/common';
import type { PpeIssue, PpeNormItem } from '@prisma/client';
import type { IssueSchedule } from './ppe-issue-schedule.types';
import type { NormItemChain, PositionNorm } from './ppe-norm-position.service';
import { DAY, addPeriod, maxDate } from './ppe-norm-transition.dates';

@Injectable()
export class PpeNormIntervalTransitionService {
  evaluate(
    chain: NormItemChain,
    norm: PositionNorm,
    item: PpeNormItem,
    on: Date,
    history: PpeIssue[],
    assignedAt?: Date | null,
  ) {
    const active = history.filter(
      (issue) =>
        issue.status === 'ISSUED' &&
        (norm.transitionMode !== 'HARD' || issue.normItemId === item.id),
    );
    const ordered = [...active].sort(
      (a, b) =>
        Math.max(Number(a.scheduledAt ?? a.issuedAt), Number(a.issuedAt)) -
          Math.max(Number(b.scheduledAt ?? b.issuedAt), Number(b.issuedAt)) ||
        Number(a.issuedAt) - Number(b.issuedAt) ||
        a.id - b.id,
    );
    const last = ordered.at(-1);
    let due = this.deadline(chain, last);
    // Retain cancelled current obligations even when later obligations were issued.
    // A replacement with the same scheduled date closes that obligation again.
    const reopened = history
      .filter(
        (issue) =>
          issue.status === 'CANCELLED' &&
          issue.normItemId === item.id &&
          issue.scheduledAt &&
          !active.some(
            (other) =>
              other.normItemId === item.id &&
              Number(other.scheduledAt) === Number(issue.scheduledAt),
          ),
      )
      .sort((a, b) => Number(a.scheduledAt) - Number(b.scheduledAt))[0];
    if (reopened?.scheduledAt && (!due || reopened.scheduledAt < due))
      due = maxDate(norm.effectiveFrom, reopened.scheduledAt);
    const inside =
      due !== null && (!norm.effectiveTo || due <= norm.effectiveTo);
    const previous = due
      ? ordered
          .filter((issue) => (issue.scheduledAt ?? issue.issuedAt) < due)
          .at(-1)
      : undefined;
    const next = due ? addPeriod(due, item) : null;
    const duration =
      item.periodUnit === 'DAY'
        ? item.periodCount
        : due && next
          ? Math.max(1, (Number(next) - Number(due)) / DAY)
          : 30;
    const availableFrom =
      inside && due
        ? maxDate(
            new Date(Number(due) - Math.min(30, duration) * DAY),
            ...(assignedAt && assignedAt <= on ? [assignedAt] : []),
            ...(previous ? [previous.issuedAt] : []),
          )
        : null;
    const available =
      due && availableFrom && on >= availableFrom
        ? { scheduledAt: due, quantity: item.quantity.toNumber() }
        : null;
    const overdue = available && due! < on ? 1 : 0;
    const state: IssueSchedule = {
      plannedDate: inside ? due : null,
      availableFrom,
      obligationStatus: !inside
        ? 'FINISHED'
        : !available
          ? 'NOT_AVAILABLE'
          : due! > on
            ? 'EARLY'
            : overdue
              ? 'OVERDUE'
              : 'DUE',
      overdue,
      available,
      nextFuture:
        inside && due! > on
          ? { scheduledAt: due!, quantity: item.quantity.toNumber() }
          : null,
    };
    return {
      state,
      fulfilled: active.filter((issue) => issue.normItemId === item.id),
    };
  }

  deadline(chain: NormItemChain, last?: PpeIssue): Date | null {
    const [{ norm, item }, ...ancestors] = chain;
    if (!last) return norm.effectiveFrom;
    if (norm.transitionMode === 'HARD' && last.normItemId !== item.id)
      return norm.effectiveFrom;
    const previous = ancestors[0];
    if (last.normItemId === item.id || !previous) {
      const end = addPeriod(
        maxDate(last.scheduledAt ?? last.issuedAt, last.issuedAt),
        item,
      );
      return end ? maxDate(norm.effectiveFrom, end) : null;
    }
    const retained = this.deadline([previous, ...ancestors.slice(1)], last);
    return retained ? maxDate(norm.effectiveFrom, retained) : null;
  }
}
