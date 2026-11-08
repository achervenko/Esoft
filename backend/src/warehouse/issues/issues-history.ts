import type { Prisma } from '@prisma/client';
import { InternalServerErrorException } from '@nestjs/common';
import { warehouseItemIdentityDto } from '../catalog/catalog.dto';
import {
  locationWithWarehouseDto,
  warehouseDto,
} from '../storage-structure/storage-structure.dto';
import type { IssuePlan } from './issues-plan.service';
export type IssueHeaderSnapshot = {
  version: 1;
  warehouse: ReturnType<typeof warehouseDto>;
  issuedBy: { id: string; name: string };
  issueSheet: { id: string; name: string; rowNumber: number } | null;
};
export type IssuePositionSnapshot = {
  item: ReturnType<typeof warehouseItemIdentityDto>;
  location: ReturnType<typeof locationWithWarehouseDto>;
};
export async function captureIssueHeader(
  tx: Prisma.TransactionClient,
  actor: string,
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
    issuedBy: user,
    issueSheet: line
      ? {
          id: String(line.issueSheet.id),
          name: line.issueSheet.name,
          rowNumber: line.rowNumber,
        }
      : null,
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
    header.warehouse.name,
    header.issuedBy.name,
    header.issueSheet?.name,
    comment,
    ...positions.flatMap((p) => [
      p.item.article,
      p.item.name,
      p.item.unit,
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
