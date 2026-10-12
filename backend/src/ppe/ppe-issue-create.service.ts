import { PpeNormTransitionService } from './ppe-norm-transition.service';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PpeIssuesGuardsService } from './ppe-issues-guards.service';
import { PpeIssueHistoryService } from './ppe-issue-history.service';
import { type ScheduledObligation } from './ppe-issue-schedule.types';
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
      const current = regular
        ? await this.guards.lockEffectiveNorm(tx, position.id, data.issuedAt)
        : null;
      const norms = current ? [current] : [];
      if (regular) {
        const missingIds = [
          ...new Set(data.items.map((item) => item.normItemId!)),
        ].filter((id) => !current?.items.some((item) => item.id === id));
        if (missingIds.length) {
          norms.push(
            ...(await this.guards.lockRequestedFutureNorms(
              tx,
              position.id,
              data.issuedAt,
              missingIds,
            )),
          );
        }
        if (!norms.length) ppeNotFound('PPE_NORM_NOT_FOUND');
      }
      const catalogIds = [
        ...data.items.map((item) => item.ppeItemId),
        ...norms.flatMap((norm) => norm.items.map((item) => item.ppeItemId)),
      ];
      const catalog = await this.guards.lockCatalog(tx, catalogIds, false);
      const historyById = new Map<
        number,
        Awaited<ReturnType<PpeIssueHistoryService['relevantIssues']>>[number]
      >();
      for (const norm of norms) {
        for (const issue of await this.history.relevantIssues(
          tx,
          employee.id,
          norm,
        ))
          historyById.set(issue.id, issue);
      }
      const issued = [...historyById.values()];
      const contexts = new Map<
        number,
        Awaited<ReturnType<PpeNormTransitionService['prepare']>>
      >();
      for (const norm of norms)
        contexts.set(norm.id, await this.transitions.prepare(tx, norm, issued));
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
        const norm = norms.find((norm) =>
          norm.items.some((item) => item.id === requested.normItemId),
        );
        if (regular && !norm) ppeNotFound('PPE_NORM_ITEM_NOT_FOUND');
        const normItem = norm?.items.find(
          (item) => item.id === requested.normItemId,
        );
        let obligation: ScheduledObligation | null = null;
        if (regular && norm) {
          if (!normItem) ppeNotFound('PPE_NORM_ITEM_NOT_FOUND');
          this.guards.assertReplacement(normItem, actual);
          const { state } = this.transitions.evaluate(
            contexts.get(norm.id)!,
            norm,
            normItem,
            data.issuedAt,
            issued,
            employee.positionAssignedAt,
          );
          obligation = state.available;
          if (!obligation) {
            if (state.obligationStatus === 'FINISHED')
              this.guards.conflict(
                'PPE_NORM_ALREADY_ISSUED',
                'Для этой нормы нет следующей нормативной обязанности.',
              );
            this.guards.conflict(
              'PPE_NORM_NOT_DUE',
              'Окно нормативной выдачи ещё не открыто. Для дополнительной выдачи используйте EXTRA.',
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
            quantity: regular ? obligation!.quantity : requested.quantity!,
            ...size,
            scheduledAt: obligation?.scheduledAt ?? null,
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
