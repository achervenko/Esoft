import { PpeNormTransitionService } from './ppe-norm-transition.service';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PpeIssuesGuardsService } from './ppe-issues-guards.service';
import { PpeIssueHistoryService } from './ppe-issue-history.service';
import { type ScheduledObligation } from './ppe-issue-schedule.types';
import { toPpeIssueDto, ppeEmployeeName } from './ppe-issues.mapper';
import { normDateString } from './ppe-norms.mapper';
import { parseNormDate, parseNormId } from './ppe-norms.validation';
import { runPpeIssueTransaction } from './ppe-issues.transaction';

@Injectable()
export class PpeIssuePlanService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly guards: PpeIssuesGuardsService,
    private readonly transitions: PpeNormTransitionService,
    private readonly history: PpeIssueHistoryService,
  ) {}
  plan(employeeId: number, date: Date) {
    parseNormId(employeeId, 'INVALID_EMPLOYEE_ID');
    const on = parseNormDate(normDateString(date));
    return runPpeIssueTransaction(this.prisma, this.guards, async (tx) => {
      const employee = await this.guards.lockEmployee(tx, employeeId, false);
      const position = await this.guards.lockPosition(tx, employee.positionId);
      const current = await this.guards.lockEffectiveNorm(
        tx,
        employee.positionId,
        on,
      );
      const future = await this.guards.lockFutureNorm(
        tx,
        employee.positionId,
        on,
      );
      const base = {
        employeeId,
        employeeName: ppeEmployeeName(employee),
        positionId: position.id,
        position: position.name,
        on: normDateString(on),
      };
      if (!current && !future) return { ...base, norm: null, items: [] };
      const catalog = await this.guards.lockCatalog(
        tx,
        [current, future].flatMap(
          (norm) => norm?.items.map((item) => item.ppeItemId) ?? [],
        ),
        false,
      );
      const prepare = async (norm: NonNullable<typeof current>) => {
        const issued = await this.history.relevantIssues(tx, employeeId, norm);
        const context = await this.transitions.prepare(tx, norm, issued);
        return norm.items.map((item) => ({
          norm,
          item,
          ...this.transitions.evaluate(
            context,
            norm,
            item,
            on,
            issued,
            employee.positionAssignedAt,
          ),
        }));
      };
      const currentRows = current ? await prepare(current) : [];
      const futureRows = future ? await prepare(future) : [];
      const norm = (current ?? future)!;
      const rows = current
        ? [
            ...currentRows,
            ...futureRows.filter((row) => row.state.available !== null),
          ]
        : futureRows;
      return {
        ...base,
        norm: {
          id: norm.id,
          effectiveFrom: normDateString(norm.effectiveFrom),
          effectiveTo: norm.effectiveTo
            ? normDateString(norm.effectiveTo)
            : null,
        },
        items: rows.map(({ norm: sourceNorm, item, state, fulfilled }) => {
          const ppe = catalog.get(item.ppeItemId)!;
          return {
            normId: sourceNorm.id,
            normEffectiveFrom: normDateString(sourceNorm.effectiveFrom),
            normItemId: item.id,
            ppeItemId: ppe.id,
            article: ppe.article,
            name: item.ppeNameSnapshot,
            unit: item.ppeUnitSnapshot,
            type: item.ppeItemTypeSnapshot,
            isActive: ppe.isActive,
            normQuantity: item.quantity.toNumber(),
            periodCount: item.periodCount,
            periodUnit: item.periodUnit,
            plannedDate: state.plannedDate
              ? normDateString(state.plannedDate)
              : null,
            availableFrom: state.availableFrom
              ? normDateString(state.availableFrom)
              : null,
            obligationStatus: state.obligationStatus,
            overdue: state.overdue,
            available: this.obligationDto(state.available),
            nextFuture: this.obligationDto(state.nextFuture),
            fulfilled: fulfilled.map(toPpeIssueDto),
            sizes: this.guards.recommendSize(employee, ppe),
          };
        }),
      };
    });
  }

  private obligationDto(obligation: ScheduledObligation | null) {
    return obligation
      ? {
          scheduledAt: normDateString(obligation.scheduledAt),
          quantity: obligation.quantity,
        }
      : null;
  }
}
