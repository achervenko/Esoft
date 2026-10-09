import { Injectable } from '@nestjs/common';
import type { PpeNorm, PpeNormItem } from '@prisma/client';

const DAY_MS = 86_400_000;
const monthOffsets = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
function leap(year: number) {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}
function daysBeforeYear(year: number) {
  const previous = year - 1;
  return (
    365 * previous +
    Math.floor(previous / 4) -
    Math.floor(previous / 100) +
    Math.floor(previous / 400)
  );
}
function calendarDay(year: number, month: number, day: number) {
  return (
    daysBeforeYear(year) +
    monthOffsets[month] +
    (month > 1 && leap(year) ? 1 : 0) +
    day -
    1 -
    daysBeforeYear(1970)
  );
}
function addMonthsDay(anchor: Date, months: number) {
  const totalMonths =
    anchor.getUTCFullYear() * 12 + anchor.getUTCMonth() + months;
  const year = Math.floor(totalMonths / 12);
  const month = totalMonths % 12;
  const lastDay =
    month === 1
      ? leap(year)
        ? 29
        : 28
      : [3, 5, 8, 10].includes(month)
        ? 30
        : 31;
  return calendarDay(year, month, Math.min(anchor.getUTCDate(), lastDay));
}
function asDate(day: number) {
  return day <= calendarDay(9999, 11, 31) ? new Date(day * DAY_MS) : null;
}

export type ScheduledPortion = {
  index: number;
  scheduledAt: Date;
  quantity: number;
};

export type IssueSchedule = {
  cycleFrom: Date;
  cycleTo: Date | null;
  totalPortions: number;
  duePortions: number;
  fulfilledPortions: number;
  dueUnissued: number;
  overdue: number;
  available: ScheduledPortion | null;
  nextFuture: ScheduledPortion | null;
};

@Injectable()
export class PpeIssueScheduleService {
  build(
    norm: Pick<PpeNorm, 'effectiveFrom' | 'effectiveTo'>,
    item: Pick<
      PpeNormItem,
      'quantity' | 'periodCount' | 'periodUnit' | 'ppeUnitSnapshot'
    >,
    on: Date,
    fulfilled: ReadonlySet<number> = new Set(),
  ): IssueSchedule {
    const months = item.periodCount * (item.periodUnit === 'YEAR' ? 12 : 1);
    const elapsedMonths =
      (on.getUTCFullYear() - norm.effectiveFrom.getUTCFullYear()) * 12 +
      on.getUTCMonth() -
      norm.effectiveFrom.getUTCMonth();
    let cycle = Math.max(0, Math.floor(elapsedMonths / months));
    const onDay = Math.floor(on.getTime() / DAY_MS);
    if (addMonthsDay(norm.effectiveFrom, cycle * months) > onDay && cycle > 0)
      cycle--;
    const fromDay = addMonthsDay(norm.effectiveFrom, cycle * months);
    const endDay = addMonthsDay(norm.effectiveFrom, (cycle + 1) * months);
    const quantity = item.quantity.toNumber();
    const portions =
      item.ppeUnitSnapshot !== 'мл' &&
      Number.isInteger(quantity) &&
      quantity >= 1
        ? quantity
        : 1;
    const portionQuantity = portions === 1 ? quantity : 1;
    const dateDay = (index: number) =>
      months % portions === 0
        ? addMonthsDay(
            norm.effectiveFrom,
            cycle * months + index * (months / portions),
          )
        : fromDay +
          Number((BigInt(endDay - fromDay) * BigInt(index)) / BigInt(portions));
    const countThrough = (day: number) => {
      let low = 0;
      let high = portions;
      while (low < high) {
        const mid = Math.floor((low + high) / 2);
        if (dateDay(mid) <= day) low = mid + 1;
        else high = mid;
      }
      return low;
    };
    const normEndDay = norm.effectiveTo
      ? Math.floor(norm.effectiveTo.getTime() / DAY_MS)
      : endDay - 1;
    const totalPortions = countThrough(Math.min(normEndDay, endDay - 1));
    const duePortions = Math.min(totalPortions, countThrough(onDay));
    const overduePortions = Math.min(totalPortions, countThrough(onDay - 1));
    const validFulfilled = [...fulfilled].filter(
      (index) => Number.isInteger(index) && index >= 0 && index < totalPortions,
    );
    const fulfilledDue = validFulfilled.filter(
      (index) => index < duePortions,
    ).length;
    const fulfilledOverdue = validFulfilled.filter(
      (index) => index < overduePortions,
    ).length;
    let firstMissing = 0;
    while (fulfilled.has(firstMissing) && firstMissing < totalPortions)
      firstMissing++;
    const portion = (index: number): ScheduledPortion | null => {
      const scheduledAt = asDate(dateDay(index));
      return scheduledAt
        ? { index, scheduledAt, quantity: portionQuantity }
        : null;
    };
    let firstFuture = duePortions;
    while (fulfilled.has(firstFuture) && firstFuture < totalPortions)
      firstFuture++;
    return {
      cycleFrom: new Date(fromDay * DAY_MS),
      cycleTo: asDate(Math.min(normEndDay, endDay - 1)),
      totalPortions,
      duePortions,
      fulfilledPortions: validFulfilled.length,
      dueUnissued: duePortions - fulfilledDue,
      overdue: overduePortions - fulfilledOverdue,
      available: firstMissing < duePortions ? portion(firstMissing) : null,
      nextFuture:
        firstFuture < totalPortions
          ? portion(firstFuture)
          : (!norm.effectiveTo || endDay <= normEndDay) && asDate(endDay)
            ? {
                index: 0,
                scheduledAt: asDate(endDay)!,
                quantity: portionQuantity,
              }
            : null,
    };
  }
}
