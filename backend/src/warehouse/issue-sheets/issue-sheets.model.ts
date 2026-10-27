import { ConflictException, NotFoundException } from '@nestjs/common';
import {
  Prisma,
  type WarehouseIssueSheet,
  type WarehouseIssueSheetLine,
} from '@prisma/client';

export const SHEET_STATUSES = [
  'DRAFT',
  'READY',
  'IN_PROGRESS',
  'PROCESSED',
  'PROCESSED_WITH_SHORTAGE',
  'CANCELLED',
] as const;
export const MATCHING_STATUSES = ['UNMATCHED', 'MATCHED', 'ERROR'] as const;
export const CLOSED_STATUSES = [
  'PROCESSED',
  'PROCESSED_WITH_SHORTAGE',
  'CANCELLED',
];
export type SheetStatus = (typeof SHEET_STATUSES)[number];
export type MatchingStatus = (typeof MATCHING_STATUSES)[number];

export function sheetConflict(code: string, message: string): never {
  throw new ConflictException({ code, message });
}
export function sheetNotFound(line = false): never {
  throw new NotFoundException({
    code: line
      ? 'WAREHOUSE_ISSUE_SHEET_LINE_NOT_FOUND'
      : 'WAREHOUSE_ISSUE_SHEET_NOT_FOUND',
    message: line ? 'Строка листа не найдена.' : 'Лист выдачи не найден.',
  });
}
export function assertSheetOpen(status: string) {
  if (['DRAFT', 'READY', 'IN_PROGRESS'].includes(status)) return;
  if (CLOSED_STATUSES.includes(status))
    sheetConflict('WAREHOUSE_ISSUE_SHEET_CLOSED', 'Лист выдачи уже закрыт.');
  sheetConflict(
    'WAREHOUSE_ISSUE_SHEET_STATE',
    'Неизвестное состояние листа выдачи.',
  );
}
export function sheetDto(sheet: WarehouseIssueSheet) {
  return {
    ...sheet,
    id: String(sheet.id),
    warehouseId: String(sheet.warehouseId),
  };
}
export function lineProgress(
  required: Prisma.Decimal,
  issued = new Prisma.Decimal(0),
) {
  if (issued.gt(required))
    sheetConflict(
      'WAREHOUSE_ISSUE_SHEET_OVERISSUED',
      'Фактическая выдача превышает задание.',
    );
  return {
    requiredQuantity: required.toString(),
    issuedQuantity: issued.toString(),
    remainingQuantity: required.minus(issued).toString(),
    executionState: issued.isZero()
      ? 'NOT_STARTED'
      : issued.lt(required)
        ? 'PARTIAL'
        : 'COMPLETED',
  };
}
export function lineDto(
  line: WarehouseIssueSheetLine,
  issued?: Prisma.Decimal,
) {
  return {
    ...line,
    id: String(line.id),
    issueSheetId: String(line.issueSheetId),
    itemId: line.itemId?.toString() ?? null,
    storageLocationId: line.storageLocationId?.toString() ?? null,
    projectId: line.projectId?.toString() ?? null,
    quantity: line.quantity.toString(),
    ...lineProgress(line.quantity, issued),
  };
}
// Count actual positions, not the number of issues. No stock/reservation tables are involved.
export const lineProgressSql = Prisma.sql`
 SELECT l.*, COALESCE(p.issued, 0) AS issued, COALESCE(p.issue_count, 0) AS issue_count
 FROM warehouse_issue_sheet_lines l
 LEFT JOIN LATERAL (
   SELECT SUM(ip.quantity) AS issued, COUNT(DISTINCT i.id) AS issue_count
   FROM warehouse_issues i
   LEFT JOIN warehouse_issue_positions ip ON ip.issue_id = i.id
   WHERE i.issue_sheet_line_id = l.id
 ) p ON TRUE`;
