import {
  locationWithWarehouseSelect,
  locationWithWarehouseDto,
} from '../storage-structure/storage-structure.dto';
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { parseWarehouseId } from '../catalog/catalog.validation';
import { reservationAvailability } from '../reservations/reservation-consumption';
import { parseAvailableQuery, parseIssueFilters } from './issues.validation';
import {
  issueConflict,
  issueDto,
  issueInclude,
  issueNotFound,
} from './issues.model';

@Injectable()
export class WarehouseIssuesQueryService {
  constructor(private readonly prisma: PrismaService) {}
  async available(value: unknown) {
    const q = parseAvailableQuery(value);
    return this.prisma.$transaction(
      async (tx) => {
        const item = await tx.warehouseItem.findUnique({
          where: { id: q.itemId },
        });
        if (!item?.isActive)
          issueConflict(
            'WAREHOUSE_ISSUE_ITEM_UNAVAILABLE',
            'Номенклатура недоступна.',
          );
        if (q.projectId !== null) {
          const project = await tx.warehouseProject.findUnique({
            where: { id: q.projectId },
          });
          if (!project?.isActive)
            issueConflict(
              'WAREHOUSE_ISSUE_PROJECT_UNAVAILABLE',
              'Проект недоступен.',
            );
        }
        const balances = await tx.warehouseBalance.findMany({
          where: {
            itemId: q.itemId,
            storageLocation: { isActive: true, warehouseId: q.warehouseId },
          },
          include: {
            storageLocation: { select: locationWithWarehouseSelect },
            reservations: {
              include: {
                project: { select: { projectNumber: true, name: true } },
              },
            },
          },
          orderBy: [{ storageLocation: { code: 'asc' } }, { id: 'asc' }],
        });
        return {
          items: balances
            .map((balance) => {
              const r = reservationAvailability(
                balance.quantity,
                balance.reservations,
                q.projectId,
              );
              return {
                balanceId: String(balance.id),
                itemId: String(balance.itemId),
                location: locationWithWarehouseDto(balance.storageLocation),
                physical: balance.quantity.toString(),
                reserved: r.reserved.toString(),
                reservedForCurrentProject: r.own.toString(),
                reservedForOtherProjects: r.others.toString(),
                available: r.available.toString(),
              };
            })
            .filter(
              (b) =>
                q.includeUnavailable || new Prisma.Decimal(b.available).gt(0),
            ),
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }
  async get(value: string) {
    const id = parseWarehouseId(value);
    return this.prisma.$transaction(
      async (tx) => {
        const issue = await tx.warehouseIssue.findUnique({
          where: { id },
          include: issueInclude,
        });
        if (!issue) issueNotFound();
        return issueDto(issue);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }
  async list(value: unknown) {
    const q = parseIssueFilters(value);
    const conditions = [Prisma.sql`TRUE`],
      positionConditions: Prisma.Sql[] = [];
    if (q.search) {
      const pattern = `%${q.search.replace(/[\\%_]/g, (char) => '\\' + char)}%`;
      conditions.push(Prisma.sql`i.search_text ILIKE ${pattern}`);
    }
    if (q.warehouseId)
      conditions.push(Prisma.sql`i.warehouse_id = ${q.warehouseId}`);
    if (q.types)
      conditions.push(Prisma.sql`i.type IN (${Prisma.join(q.types)})`);
    if (q.projectIds)
      conditions.push(
        Prisma.sql`i.project_id IN (${Prisma.join(q.projectIds)})`,
      );
    if (q.issueSheetLineId)
      conditions.push(
        Prisma.sql`i.issue_sheet_line_id = ${q.issueSheetLineId}`,
      );
    if (q.issueSheetId)
      conditions.push(
        Prisma.sql`EXISTS (SELECT 1 FROM warehouse_issue_sheet_lines l WHERE l.id = i.issue_sheet_line_id AND l.issue_sheet_id = ${q.issueSheetId})`,
      );
    if (q.issuedByUserId !== undefined)
      conditions.push(Prisma.sql`i.issued_by_user_id = ${q.issuedByUserId}`);
    if (q.overrideReservations !== undefined)
      conditions.push(
        Prisma.sql`i.override_reservations = ${q.overrideReservations}`,
      );
    if (q.createdFrom)
      conditions.push(Prisma.sql`i.created_at >= ${q.createdFrom}`);
    if (q.createdTo)
      conditions.push(Prisma.sql`i.created_at <= ${q.createdTo}`);
    if (q.itemIds)
      positionConditions.push(
        Prisma.sql`b.item_id IN (${Prisma.join(q.itemIds)})`,
      );
    if (q.balanceId)
      positionConditions.push(Prisma.sql`p.balance_id = ${q.balanceId}`);
    if (q.locationId)
      positionConditions.push(
        Prisma.sql`b.storage_location_id = ${q.locationId}`,
      );
    if (q.minQuantity)
      positionConditions.push(
        Prisma.sql`p.quantity >= ${q.minQuantity.toString()}::numeric`,
      );
    if (q.maxQuantity)
      positionConditions.push(
        Prisma.sql`p.quantity <= ${q.maxQuantity.toString()}::numeric`,
      );
    if (positionConditions.length)
      conditions.push(
        Prisma.sql`EXISTS (SELECT 1 FROM warehouse_issue_positions p JOIN warehouse_balances b ON b.id = p.balance_id WHERE p.issue_id = i.id AND ${Prisma.join(positionConditions, ' AND ')})`,
      );
    const from = Prisma.sql`FROM warehouse_issues i WHERE ${Prisma.join(conditions, ' AND ')}`;
    const sort =
      q.sortBy === 'quantity'
        ? Prisma.sql`(SELECT COALESCE(SUM(p.quantity),0) FROM warehouse_issue_positions p WHERE p.issue_id = i.id)`
        : Prisma.sql`i.created_at`;
    const direction =
      q.sortOrder === 'asc' ? Prisma.sql`ASC` : Prisma.sql`DESC`;
    return this.prisma.$transaction(
      async (tx) => {
        const [ids, total] = await Promise.all([
          tx.$queryRaw<{ id: bigint }[]>(
            Prisma.sql`SELECT i.id ${from} ORDER BY ${sort} ${direction}, i.id ${direction} LIMIT ${q.limit} OFFSET ${(q.page - 1) * q.limit}`,
          ),
          tx.$queryRaw<{ total: bigint }[]>(
            Prisma.sql`SELECT COUNT(*) AS total ${from}`,
          ),
        ]);
        const rows = await tx.warehouseIssue.findMany({
          where: { id: { in: ids.map((r) => r.id) } },
          include: issueInclude,
        });
        const byId = new Map(rows.map((r) => [r.id, r]));
        return {
          items: ids.map((r) => issueDto(byId.get(r.id)!)),
          total: Number(total[0].total),
          page: q.page,
          limit: q.limit,
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }
}
