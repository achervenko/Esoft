import { PpeNormTransitionService } from './ppe-norm-transition.service';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PpeIssuesGuardsService } from './ppe-issues-guards.service';
import { PpeIssueHistoryService } from './ppe-issue-history.service';
import { type ScheduledPortion } from './ppe-issue-schedule.service';
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
      const norm = await this.guards.lockEffectiveNorm(
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
      if (!norm) return { ...base, norm: null, items: [] };
      const catalog = await this.guards.lockCatalog(
        tx,
        norm.items.map((item) => item.ppeItemId),
        false,
      );
      const issued = await this.history.relevantIssues(tx, employeeId, norm);
      const context = await this.transitions.prepare(tx, norm, issued);
      return {
        ...base,
        norm: {
          id: norm.id,
          effectiveFrom: normDateString(norm.effectiveFrom),
          effectiveTo: norm.effectiveTo
            ? normDateString(norm.effectiveTo)
            : null,
        },
        items: norm.items.map((item) => {
          const { state, fulfilled } = this.transitions.evaluate(
            context,
            norm,
            item,
            on,
            issued,
            employee.positionAssignedAt,
          );
          const ppe = catalog.get(item.ppeItemId)!;
          return {
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
            cycleFrom: normDateString(state.cycleFrom),
            cycleTo: state.cycleTo ? normDateString(state.cycleTo) : null,
            totalPortions: state.totalPortions,
            duePortions: state.duePortions,
            fulfilledPortions: state.fulfilledPortions,
            dueUnissued: state.dueUnissued,
            overdue: state.overdue,
            available: this.portionDto(state.available),
            nextFuture: this.portionDto(state.nextFuture),
            fulfilled: fulfilled.map(toPpeIssueDto),
            sizes: this.guards.recommendSize(employee, ppe),
          };
        }),
      };
    });
  }

  private portionDto(portion: ScheduledPortion | null) {
    return portion
      ? {
          scheduledAt: normDateString(portion.scheduledAt),
          scheduledPortion: portion.index,
          quantity: portion.quantity,
        }
      : null;
  }
}
