import { BadRequestException, Injectable } from '@nestjs/common';
import { PpeIssueStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ppeNotFound } from './ppe.errors';
import { PpeIssuesAuditService } from './ppe-issues-audit.service';
import { PpeIssuesGuardsService } from './ppe-issues-guards.service';
import { PpeIssuePlanService } from './ppe-issue-plan.service';
import { PpeIssueCreateService } from './ppe-issue-create.service';
import { toPpeIssueDto } from './ppe-issues.mapper';
import {
  parseIssueCancellation,
  parseIssueListQuery,
  type IssueActor,
} from './ppe-issues.validation';
import { parseNormId } from './ppe-norms.validation';
import { runPpeIssueTransaction } from './ppe-issues.transaction';
import { loadJournalPage } from './ppe-journal-query';

@Injectable()
export class PpeIssuesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly guards: PpeIssuesGuardsService,
    private readonly audit: PpeIssuesAuditService,
    private readonly plans: PpeIssuePlanService,
    private readonly creation: PpeIssueCreateService,
  ) {}
  async list(query: unknown) {
    const filter = parseIssueListQuery(query);
    const issues = await this.prisma.ppeIssue.findMany({
      take: 101,
      where: {
        employeeId: filter.employeeId,
        positionId: filter.positionId,
        ppeItemId: filter.ppeItemId,
        issueType: filter.issueType,
        status: filter.status,
        ...(filter.dateFrom || filter.dateTo
          ? { issuedAt: { gte: filter.dateFrom, lte: filter.dateTo } }
          : {}),
      },
      orderBy: [{ issuedAt: 'desc' }, { id: 'desc' }],
    });
    if (issues.length > 100)
      throw new BadRequestException(
        'Для больших журналов используйте /api/ppe/issues/page.',
      );
    return issues.map(toPpeIssueDto);
  }
  listPage(query: unknown) {
    return loadJournalPage(this.prisma, query);
  }

  async findOne(id: number) {
    parseNormId(id, 'INVALID_ISSUE_ID');
    const issue = await this.prisma.ppeIssue.findUnique({ where: { id } });
    if (!issue) ppeNotFound('PPE_ISSUE_NOT_FOUND');
    return toPpeIssueDto(issue);
  }

  plan(employeeId: number, date: Date) {
    return this.plans.plan(employeeId, date);
  }
  recommendSize(employeeId: number, itemId: number) {
    parseNormId(employeeId, 'INVALID_EMPLOYEE_ID');
    parseNormId(itemId, 'INVALID_PPE_ITEM_ID');
    return runPpeIssueTransaction(this.prisma, this.guards, async (tx) => {
      const employee = await this.guards.lockEmployee(tx, employeeId, false);
      const catalog = await this.guards.lockCatalog(tx, [itemId], false);
      return this.guards.recommendSize(employee, catalog.get(itemId)!);
    });
  }
  createRegular(payload: unknown, actor: IssueActor) {
    return this.creation.createRegular(payload, actor);
  }
  createExtra(payload: unknown, actor: IssueActor) {
    return this.creation.createExtra(payload, actor);
  }
  cancel(id: number, payload: unknown, actorUserId: string) {
    parseNormId(id, 'INVALID_ISSUE_ID');
    const reason = parseIssueCancellation(payload);
    return runPpeIssueTransaction(this.prisma, this.guards, async (tx) => {
      const initial = await tx.ppeIssue.findUnique({
        where: { id },
        select: { employeeId: true },
      });
      if (!initial) ppeNotFound('PPE_ISSUE_NOT_FOUND');
      await this.guards.lockEmployee(tx, initial.employeeId, false);
      await tx.$queryRaw`SELECT id FROM ppe_issues WHERE id = ${id} FOR UPDATE`;
      const issue = await tx.ppeIssue.findUnique({ where: { id } });
      if (!issue) ppeNotFound('PPE_ISSUE_NOT_FOUND');
      if (issue.status === PpeIssueStatus.CANCELLED)
        this.guards.conflict(
          'PPE_ISSUE_ALREADY_CANCELLED',
          'Выдача уже отменена.',
        );
      const name = await this.guards.actorName(tx, actorUserId);
      const cancelled = await tx.ppeIssue.update({
        where: { id },
        data: {
          status: PpeIssueStatus.CANCELLED,
          cancelledAt: new Date(),
          cancelledByUserId: actorUserId,
          cancelledByNameSnapshot: name,
          cancellationReason: reason,
        },
      });
      await this.audit.cancelled(tx, id, reason, actorUserId);
      return toPpeIssueDto(cancelled);
    });
  }
}
