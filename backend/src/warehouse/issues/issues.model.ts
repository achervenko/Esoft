import {
  issueHeaderSnapshot,
  type IssuePositionSnapshot,
} from './issues-history';
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
  positions: { orderBy: { id: 'asc' } },
} satisfies Prisma.WarehouseIssueInclude;
export type IssueRow = Prisma.WarehouseIssueGetPayload<{
  include: typeof issueInclude;
}>;
export function issueDto(issue: IssueRow) {
  const snapshot = issueHeaderSnapshot(issue.snapshot);
  return {
    id: String(issue.id),
    warehouseId: String(issue.warehouseId),
    warehouse: snapshot.warehouse,
    type: issue.type,
    projectId: issue.projectId?.toString() ?? null,
    issueSheetLineId: issue.issueSheetLineId?.toString() ?? null,
    project: snapshot.project,
    issuedByUserId: issue.issuedByUserId,
    issuedBy: snapshot.issuedBy,
    issueSheet: snapshot.issueSheet,
    createdAt: issue.createdAt,
    comment: issue.comment,
    overrideReservations: issue.overrideReservations,
    totalQuantity: issue.positions
      .reduce((sum, p) => sum.plus(p.quantity), new Prisma.Decimal(0))
      .toString(),
    positions: issue.positions.map((p) => {
      const saved = p.snapshot as unknown as IssuePositionSnapshot;
      return {
        id: String(p.id),
        issueId: String(p.issueId),
        balanceId: String(p.balanceId),
        quantity: p.quantity.toString(),
        item: saved.item,
        location: saved.location,
      };
    }),
    reservationUsage: snapshot.reservationUsage,
    foreignReservationsUsed: snapshot.foreignReservationsUsed,
  };
}
