import { PpeNormTransitionService } from './ppe-norm-transition.service';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PpeIssuesGuardsService } from './ppe-issues-guards.service';
import { PpeIssueHistoryService } from './ppe-issue-history.service';
import { type ScheduledPortion } from './ppe-issue-schedule.service';
import { toPpeIssueDto, ppeEmployeeName } from './ppe-issues.mapper';
import { runPpeIssueTransaction } from './ppe-issues.transaction';
import { PpeIssueStatus, PpeIssueType } from '@prisma/client';
import { ppeNotFound } from './ppe.errors';
import { PpeIssuesAuditService } from './ppe-issues-audit.service';
import type { PpeIssueWarning } from './ppe-issues-guards.service';
import { parseIssueBatch, type IssueActor } from './ppe-issues.validation';

@Injectable()
export class PpeIssueCreateService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly guards: PpeIssuesGuardsService,
    private readonly transitions: PpeNormTransitionService,
    private readonly audit: PpeIssuesAuditService,
    private readonly history: PpeIssueHistoryService,
  ) {}
  createRegular(payload: unknown, actor: IssueActor) {
    return this.createBatch(payload, actor, true);
  }

  createExtra(payload: unknown, actor: IssueActor) {
    return this.createBatch(payload, actor, false);
  }

  private createBatch(payload: unknown, actor: IssueActor, regular: boolean) {
    const data = parseIssueBatch(payload, regular, actor.role);
    return runPpeIssueTransaction(this.prisma, this.guards, async (tx) => {
      const employee = await this.guards.lockEmployee(tx, data.employeeId);
      const position = await this.guards.lockPosition(tx, employee.positionId);
      const norm = regular
        ? await this.guards.lockEffectiveNorm(tx, position.id, data.issuedAt)
        : null;
      if (regular && !norm) ppeNotFound('PPE_NORM_NOT_FOUND');
      const catalogIds = [
        ...data.items.map((item) => item.ppeItemId),
        ...(norm?.items.map((item) => item.ppeItemId) ?? []),
      ];
      const catalog = await this.guards.lockCatalog(tx, catalogIds, false);
      const issued = norm
        ? await this.history.relevantIssues(tx, employee.id, norm)
        : [];
      const context = norm
        ? await this.transitions.prepare(tx, norm, issued)
        : null;
      const actorName = await this.guards.actorName(tx, actor.userId);
      const results: (ReturnType<typeof toPpeIssueDto> & {
        warnings: PpeIssueWarning[];
      })[] = [];
      for (const requested of data.items) {
        const actual = catalog.get(requested.ppeItemId)!;
        this.guards.assertActive(actual);
        const { warnings, ...size } = this.guards.resolveSize(
          employee,
          actual,
          requested.sizeId,
        );
        const normItem = norm?.items.find(
          (item) => item.id === requested.normItemId,
        );
        let portion: ScheduledPortion | null = null;
        if (regular && norm) {
          if (!normItem) ppeNotFound('PPE_NORM_ITEM_NOT_FOUND');
          this.guards.assertReplacement(normItem, actual);
          const { state } = this.transitions.evaluate(
            context!,
            norm,
            normItem,
            data.issuedAt,
            issued,
            employee.positionAssignedAt,
          );
          portion = state.available;
          if (!portion) {
            if (state.fulfilledPortions >= state.totalPortions)
              this.guards.conflict(
                'PPE_NORM_ALREADY_ISSUED',
                'Все нормативные порции текущего периода уже выданы.',
              );
            this.guards.conflict(
              'PPE_NORM_NOT_DUE',
              'Очередная нормативная выдача ещё не наступила. Для досрочной выдачи используйте EXTRA.',
            );
          }
        }
        const issue = await tx.ppeIssue.create({
          data: {
            employeeId: employee.id,
            employeeNameSnapshot: ppeEmployeeName(employee),
            positionId: position.id,
            positionNameSnapshot: position.name,
            issueType: regular ? PpeIssueType.REGULAR : PpeIssueType.EXTRA,
            normItemId: regular ? normItem!.id : null,
            normItemPpeItemId: regular ? normItem!.ppeItemId : null,
            normPpeArticleSnapshot: regular
              ? catalog.get(normItem!.ppeItemId)!.article
              : null,
            normPpeNameSnapshot: regular ? normItem!.ppeNameSnapshot : null,
            ppeItemId: actual.id,
            ppeItemTypeSnapshot: actual.type,
            ppeArticleSnapshot: actual.article,
            ppeNameSnapshot: actual.name,
            ppeUnitSnapshot: actual.unit,
            quantity: regular ? portion!.quantity : requested.quantity!,
            ...size,
            scheduledAt: portion?.scheduledAt ?? null,
            scheduledPortion: portion?.index ?? null,
            issuedAt: data.issuedAt,
            issuedByUserId: actor.userId,
            issuedByNameSnapshot: actorName,
            status: PpeIssueStatus.ISSUED,
            comment: requested.comment,
          },
        });
        await this.audit.created(tx, issue.id, actor.userId);
        issued.push(issue);
        results.push({ ...toPpeIssueDto(issue), warnings });
      }
      return results;
    });
  }
}
