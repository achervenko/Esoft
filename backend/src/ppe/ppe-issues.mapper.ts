import type { PpeIssue } from '@prisma/client';
import { normDateString } from './ppe-norms.mapper';

export function toPpeIssueDto(issue: PpeIssue) {
  return {
    id: issue.id,
    employeeId: issue.employeeId,
    employeeName: issue.employeeNameSnapshot,
    positionId: issue.positionId,
    position: issue.positionNameSnapshot,
    issueType: issue.issueType,
    normItemId: issue.normItemId,
    normItemPpeItemId: issue.normItemPpeItemId,
    normPpeArticle: issue.normPpeArticleSnapshot,
    normPpeName: issue.normPpeNameSnapshot,
    ppeItemId: issue.ppeItemId,
    ppeItemTypeSnapshot: issue.ppeItemTypeSnapshot,
    article: issue.ppeArticleSnapshot,
    name: issue.ppeNameSnapshot,
    unit: issue.ppeUnitSnapshot,
    quantity: issue.quantity.toNumber(),
    sizeValue: issue.sizeValue,
    clothingHeight: issue.clothingHeightSnapshot,
    scheduledAt: issue.scheduledAt ? normDateString(issue.scheduledAt) : null,
    issuedAt: normDateString(issue.issuedAt),
    issuedByUserId: issue.issuedByUserId,
    issuedByName: issue.issuedByNameSnapshot,
    status: issue.status,
    comment: issue.comment,
    cancelledAt: issue.cancelledAt?.toISOString() ?? null,
    cancelledByUserId: issue.cancelledByUserId,
    cancelledByName: issue.cancelledByNameSnapshot,
    cancellationReason: issue.cancellationReason,
  };
}

export function ppeEmployeeName(employee: {
  lastName: string;
  firstName: string;
  middleName: string | null;
}) {
  return [employee.lastName, employee.firstName, employee.middleName]
    .filter(Boolean)
    .join(' ');
}
