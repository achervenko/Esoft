import type { Prisma } from '@prisma/client';
import { InternalServerErrorException } from '@nestjs/common';
import { warehouseItemIdentityDto } from '../catalog/catalog.dto';
import {
  locationWithWarehouseDto,
  warehouseDto,
} from '../storage-structure/storage-structure.dto';
import type { IssuePlan } from './issues-plan.service';
import type { ReservationUse } from '../reservations/reservation-consumption';
export type IssueHeaderSnapshot = {
  version: 1;
  warehouse: ReturnType<typeof warehouseDto>;
  project: { id: string; projectNumber: string; name: string | null } | null;
  issuedBy: { id: string; name: string };
  issueSheet: { id: string; name: string; rowNumber: number } | null;
  reservationUsage: ReservationUse[];
  foreignReservationsUsed: boolean;
};
export type IssuePositionSnapshot = {
  item: ReturnType<typeof warehouseItemIdentityDto>;
  location: ReturnType<typeof locationWithWarehouseDto>;
};
export async function captureIssueHeader(
  tx: Prisma.TransactionClient,
  actor: string,
  projectId: bigint | null,
  lineId: bigint | null,
  plan: IssuePlan,
): Promise<IssueHeaderSnapshot> {
  const warehouse = await tx.warehouse.findUniqueOrThrow({
    where: { id: plan.warehouseId },
  });
  const user = await tx.user.findUniqueOrThrow({
    where: { id: actor },
    select: { id: true, name: true },
  });
  const project =
    projectId === null
      ? null
      : await tx.warehouseProject.findUniqueOrThrow({
          where: { id: projectId },
          select: { id: true, projectNumber: true, name: true },
        });
  const line =
    lineId === null
      ? null
      : await tx.warehouseIssueSheetLine.findUniqueOrThrow({
          where: { id: lineId },
          select: {
            rowNumber: true,
            issueSheet: { select: { id: true, name: true } },
          },
        });
  return {
    version: 1,
    warehouse: warehouseDto(warehouse),
    project: project ? { ...project, id: String(project.id) } : null,
    issuedBy: user,
    issueSheet: line
      ? {
          id: String(line.issueSheet.id),
          name: line.issueSheet.name,
          rowNumber: line.rowNumber,
        }
      : null,
    reservationUsage: plan.changes,
    foreignReservationsUsed: plan.foreignReservations.length > 0,
  };
}
export function captureIssuePosition(
  position: IssuePlan['positions'][number],
): IssuePositionSnapshot {
  return {
    item: warehouseItemIdentityDto(position.balance.item),
    location: locationWithWarehouseDto(position.balance.storageLocation),
  };
}
export function issueHistorySearch(
  header: IssueHeaderSnapshot,
  positions: IssuePositionSnapshot[],
  comment: string | null,
) {
  return [
    header.warehouse.code,
    header.warehouse.name,
    header.project?.projectNumber,
    header.project?.name,
    header.issuedBy.name,
    header.issueSheet?.name,
    comment,
    ...header.reservationUsage.flatMap((r) => [r.projectNumber, r.projectName]),
    ...positions.flatMap((p) => [
      p.item.article,
      p.item.name,
      p.item.unit,
      p.location.code,
      p.location.name,
    ]),
  ]
    .filter((v): v is string => typeof v === 'string' && v.length > 0)
    .join('\n');
}
export function issueHeaderSnapshot(
  value: Prisma.JsonValue,
): IssueHeaderSnapshot {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    value.version !== 1
  )
    throw new InternalServerErrorException({
      code: 'WAREHOUSE_ISSUE_SNAPSHOT_INVALID',
      message: 'Исторический снимок выдачи повреждён.',
    });
  return value as unknown as IssueHeaderSnapshot;
}
