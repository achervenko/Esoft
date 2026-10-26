import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

export function issueConflict(code: string, message: string): never {
  throw new ConflictException({ code, message });
}
export function issueForbidden(): never {
  throw new ForbiddenException({
    code: 'FORBIDDEN',
    message: 'Недостаточно прав для складской выдачи.',
  });
}
export function issueNotFound(): never {
  throw new NotFoundException({
    code: 'WAREHOUSE_ISSUE_NOT_FOUND',
    message: 'Выдача не найдена.',
  });
}
export const issueInclude = {
  project: { select: { id: true, projectNumber: true, name: true } },
  issuedBy: { select: { id: true, name: true } },
  positions: {
    orderBy: { id: 'asc' },
    include: { balance: { include: { item: true, storageLocation: true } } },
  },
} satisfies Prisma.WarehouseIssueInclude;
export type IssueRow = Prisma.WarehouseIssueGetPayload<{
  include: typeof issueInclude;
}>;
export function issueDto(issue: IssueRow) {
  return {
    id: String(issue.id),
    type: issue.type,
    projectId: issue.projectId?.toString() ?? null,
    issueSheetLineId: issue.issueSheetLineId?.toString() ?? null,
    project: issue.project
      ? { ...issue.project, id: String(issue.project.id) }
      : null,
    issuedByUserId: issue.issuedByUserId,
    issuedBy: issue.issuedBy,
    createdAt: issue.createdAt,
    comment: issue.comment,
    overrideReservations: issue.overrideReservations,
    totalQuantity: issue.positions
      .reduce((sum, p) => sum.plus(p.quantity), new Prisma.Decimal(0))
      .toString(),
    positions: issue.positions.map((p) => ({
      id: String(p.id),
      issueId: String(p.issueId),
      balanceId: String(p.balanceId),
      quantity: p.quantity.toString(),
      item: {
        id: String(p.balance.item.id),
        article: p.balance.item.article,
        name: p.balance.item.name,
        unit: p.balance.item.unit,
      },
      location: {
        id: String(p.balance.storageLocation.id),
        code: p.balance.storageLocation.code,
        name: p.balance.storageLocation.name,
      },
    })),
  };
}
