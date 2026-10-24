import { Injectable } from '@nestjs/common';
import { Prisma, type WarehouseIssueSheetLine } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { parseWarehouseId } from '../catalog/catalog.validation';
import {
  lineDto,
  lineProgressSql,
  sheetDto,
  sheetNotFound,
} from './issue-sheets.model';
import { parseLineFilters, parseSheetFilters } from './issue-sheets.validation';

type ProgressRow = {
  id: bigint;
  quantity: Prisma.Decimal;
  issued: Prisma.Decimal;
};
export async function getLineProgress(
  tx: Prisma.TransactionClient,
  sheetId: bigint,
) {
  return tx.$queryRaw<ProgressRow[]>(
    Prisma.sql`SELECT id, quantity, issued FROM (${lineProgressSql}) p WHERE issue_sheet_id = ${sheetId}`,
  );
}
export async function findSheet(tx: Prisma.TransactionClient, id: bigint) {
  const sheet = await tx.warehouseIssueSheet.findUnique({ where: { id } });
  if (!sheet) sheetNotFound();
  return sheet;
}
const and = (clauses: Prisma.Sql[]) => Prisma.join(clauses, ' AND ');

@Injectable()
export class WarehouseIssueSheetsQueryService {
  constructor(private readonly prisma: PrismaService) {}
  async findOne(value: string) {
    return sheetDto(await findSheet(this.prisma, parseWarehouseId(value)));
  }
  async list(value: unknown) {
    const q = parseSheetFilters(value);
    const clauses = [Prisma.sql`TRUE`];
    if (q.statuses)
      clauses.push(Prisma.sql`s.status IN (${Prisma.join(q.statuses)})`);
    if (q.createdByUserId)
      clauses.push(Prisma.sql`s.created_by_user_id = ${q.createdByUserId}`);
    if (q.processedByUserId)
      clauses.push(Prisma.sql`s.processed_by_user_id = ${q.processedByUserId}`);
    if (q.sourceFileHash)
      clauses.push(Prisma.sql`s.source_file_hash = ${q.sourceFileHash}`);
    if (q.search) {
      const search = '%' + q.search.replace(/[\\%_]/g, '\\$&') + '%';
      clauses.push(
        Prisma.sql`(s.name ILIKE ${search} OR s.source_file_name ILIKE ${search})`,
      );
    }
    if (q.createdFrom)
      clauses.push(Prisma.sql`s.created_at >= ${q.createdFrom}`);
    if (q.createdTo) clauses.push(Prisma.sql`s.created_at <= ${q.createdTo}`);
    if (q.processedFrom)
      clauses.push(Prisma.sql`s.processed_at >= ${q.processedFrom}`);
    if (q.processedTo)
      clauses.push(Prisma.sql`s.processed_at <= ${q.processedTo}`);
    for (const [column, id] of [
      [Prisma.sql`l.item_id`, q.itemId],
      [Prisma.sql`l.project_id`, q.projectId],
    ] as const) {
      if (id !== undefined)
        clauses.push(
          Prisma.sql`EXISTS (SELECT 1 FROM warehouse_issue_sheet_lines l WHERE l.issue_sheet_id = s.id AND ${column} = ${id})`,
        );
    }
    for (const [flag, condition] of [
      [
        q.hasErrors,
        Prisma.sql`(NULLIF(BTRIM(l.error), '') IS NOT NULL OR l.matching_status = 'ERROR')`,
      ],
      [
        q.hasUnmatchedLines,
        Prisma.sql`(l.matching_status <> 'MATCHED' OR l.item_id IS NULL)`,
      ],
    ] as const) {
      if (flag !== undefined)
        clauses.push(
          Prisma.sql`EXISTS (SELECT 1 FROM warehouse_issue_sheet_lines l WHERE l.issue_sheet_id = s.id AND ${condition}) = ${flag}`,
        );
    }
    if (q.hasShortage !== undefined)
      clauses.push(
        Prisma.sql`EXISTS (SELECT 1 FROM (${lineProgressSql}) p WHERE p.issue_sheet_id = s.id AND p.quantity > p.issued) = ${q.hasShortage}`,
      );
    const order = {
      createdAt: Prisma.sql`s.created_at`,
      processedAt: Prisma.sql`s.processed_at`,
      name: Prisma.sql`s.name`,
      status: Prisma.sql`s.status`,
    }[q.sortBy];
    const direction =
      q.sortOrder === 'asc' ? Prisma.sql`ASC` : Prisma.sql`DESC`;
    return this.prisma.$transaction(
      async (tx) => {
        const where = and(clauses);
        const [ids, count] = await Promise.all([
          tx.$queryRaw<{ id: bigint }[]>(
            Prisma.sql`SELECT s.id FROM warehouse_issue_sheets s WHERE ${where} ORDER BY ${order} ${direction} NULLS LAST, s.id ${direction} LIMIT ${q.limit} OFFSET ${(q.page - 1) * q.limit}`,
          ),
          tx.$queryRaw<{ total: bigint }[]>(
            Prisma.sql`SELECT COUNT(*) AS total FROM warehouse_issue_sheets s WHERE ${where}`,
          ),
        ]);
        const sheets = await tx.warehouseIssueSheet.findMany({
          where: { id: { in: ids.map((r) => r.id) } },
        });
        const byId = new Map(sheets.map((s) => [s.id, s]));
        return {
          items: ids.map((r) => sheetDto(byId.get(r.id)!)),
          total: Number(count[0].total),
          page: q.page,
          limit: q.limit,
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }
  async lines(sheetValue: string, value: unknown) {
    const sheetId = parseWarehouseId(sheetValue);
    const q = parseLineFilters(value);
    const clauses = [Prisma.sql`p.issue_sheet_id = ${sheetId}`];
    if (q.matchingStatuses)
      clauses.push(
        Prisma.sql`p.matching_status IN (${Prisma.join(q.matchingStatuses)})`,
      );
    if (q.itemId) clauses.push(Prisma.sql`p.item_id = ${q.itemId}`);
    if (q.projectId) clauses.push(Prisma.sql`p.project_id = ${q.projectId}`);
    if (q.storageLocationId)
      clauses.push(Prisma.sql`p.storage_location_id = ${q.storageLocationId}`);
    if (q.hasError !== undefined)
      clauses.push(
        Prisma.sql`(NULLIF(BTRIM(p.error), '') IS NOT NULL OR p.matching_status = 'ERROR') = ${q.hasError}`,
      );
    if (q.rowFrom) clauses.push(Prisma.sql`p.row_number >= ${q.rowFrom}`);
    if (q.rowTo) clauses.push(Prisma.sql`p.row_number <= ${q.rowTo}`);
    if (q.executionState === 'NOT_STARTED')
      clauses.push(Prisma.sql`p.issued = 0`);
    if (q.executionState === 'PARTIAL')
      clauses.push(Prisma.sql`p.issued > 0 AND p.issued < p.quantity`);
    if (q.executionState === 'COMPLETED')
      clauses.push(Prisma.sql`p.issued = p.quantity`);
    const order =
      q.sortBy === 'quantity'
        ? Prisma.sql`p.quantity`
        : Prisma.sql`p.row_number`;
    const direction =
      q.sortOrder === 'asc' ? Prisma.sql`ASC` : Prisma.sql`DESC`;
    return this.prisma.$transaction(
      async (tx) => {
        await findSheet(tx, sheetId);
        const where = and(clauses);
        const [rows, count] = await Promise.all([
          tx.$queryRaw<(ProgressRow & { row_number: number })[]>(
            Prisma.sql`SELECT p.id, p.issued, p.quantity, p.row_number FROM (${lineProgressSql}) p WHERE ${where} ORDER BY ${order} ${direction}, p.id ${direction} LIMIT ${q.limit} OFFSET ${(q.page - 1) * q.limit}`,
          ),
          tx.$queryRaw<{ total: bigint }[]>(
            Prisma.sql`SELECT COUNT(*) AS total FROM (${lineProgressSql}) p WHERE ${where}`,
          ),
        ]);
        const lines = await tx.warehouseIssueSheetLine.findMany({
          where: { id: { in: rows.map((r) => r.id) } },
        });
        const byId = new Map<bigint, WarehouseIssueSheetLine>(
          lines.map((l) => [l.id, l]),
        );
        return {
          items: rows.map((r) => lineDto(byId.get(r.id)!, r.issued)),
          total: Number(count[0].total),
          page: q.page,
          limit: q.limit,
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }
}
