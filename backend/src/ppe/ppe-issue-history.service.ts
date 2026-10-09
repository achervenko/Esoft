import { Injectable } from '@nestjs/common';
import { Prisma, PpeIssueType, PpeIssueStatus } from '@prisma/client';
import type { IssueNorm } from './ppe-issues-guards.service';

@Injectable()
export class PpeIssueHistoryService {
  async relevantIssues(
    tx: Prisma.TransactionClient,
    employeeId: number,
    norm: IssueNorm,
  ) {
    const ids = norm.items.map((item) => item.ppeItemId);
    if (!ids.length) return [];
    await tx.$queryRaw`SELECT id FROM ppe_issues WHERE employee_id = ${employeeId} AND norm_item_ppe_item_id IN (${Prisma.join(ids)}) AND issue_type = 'REGULAR' AND status = 'ISSUED' ORDER BY id FOR UPDATE`;
    return tx.ppeIssue.findMany({
      where: {
        employeeId,
        normItemPpeItemId: { in: norm.items.map((item) => item.ppeItemId) },
        issueType: PpeIssueType.REGULAR,
        status: PpeIssueStatus.ISSUED,
      },
      orderBy: { id: 'asc' },
    });
  }
}
