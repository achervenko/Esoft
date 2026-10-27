import { lockWarehouse } from '../storage-structure/storage-structure.policy';
import { Injectable } from '@nestjs/common';
import { type Prisma } from '@prisma/client';
import { parseWarehouseId } from '../catalog/catalog.validation';
import {
  assertSheetOpen,
  lineDto,
  sheetConflict,
  sheetNotFound,
} from './issue-sheets.model';
import {
  lockIssueSheet,
  WarehouseIssueSheetTransactions,
} from './issue-sheets-transaction.service';
import { parseSheetLine, type SheetLineInput } from './issue-sheets.validation';

@Injectable()
export class WarehouseIssueSheetLinesService {
  constructor(private readonly transactions: WarehouseIssueSheetTransactions) {}
  async validateReferences(
    tx: Prisma.TransactionClient,
    data: SheetLineInput,
    warehouseId: bigint,
  ) {
    if (data.itemId) {
      const rows = await tx.$queryRaw<
        { id: bigint; is_active: boolean; unit: string }[]
      >`SELECT id, is_active, unit FROM warehouse_items WHERE id = ${data.itemId} FOR SHARE`;
      if (!rows[0] || !rows[0].is_active)
        sheetConflict(
          'WAREHOUSE_ISSUE_SHEET_ITEM_UNAVAILABLE',
          'Выберите действующую номенклатуру.',
        );
      if (data.unitSnapshot === undefined || data.unitSnapshot === null)
        data.unitSnapshot = rows[0].unit;
      if (data.unitSnapshot !== rows[0].unit)
        sheetConflict(
          'WAREHOUSE_ISSUE_SHEET_UNIT_MISMATCH',
          'Единица измерения не совпадает с номенклатурой.',
        );
    }
    if (data.storageLocationId) {
      const rows = await tx.$queryRaw<
        { is_active: boolean; warehouse_id: bigint }[]
      >`SELECT is_active, warehouse_id FROM warehouse_storage_locations WHERE id = ${data.storageLocationId} FOR SHARE`;
      if (!rows[0]?.is_active)
        sheetConflict(
          'WAREHOUSE_ISSUE_SHEET_LOCATION_UNAVAILABLE',
          'Место хранения недоступно.',
        );
      if (rows[0].warehouse_id !== warehouseId)
        sheetConflict(
          'WAREHOUSE_ISSUE_SHEET_LOCATION_MISMATCH',
          'Место не принадлежит складу листа.',
        );
    }
    if (data.projectId) {
      const rows = await tx.$queryRaw<
        { is_active: boolean }[]
      >`SELECT is_active FROM warehouse_projects WHERE id = ${data.projectId} FOR SHARE`;
      if (!rows[0]?.is_active)
        sheetConflict(
          'WAREHOUSE_ISSUE_SHEET_PROJECT_UNAVAILABLE',
          'Проект недоступен.',
        );
    }
  }
  private async invalidateReady(
    tx: Prisma.TransactionClient,
    sheet: { id: bigint; status: string },
  ) {
    if (sheet.status === 'READY')
      await tx.warehouseIssueSheet.update({
        where: { id: sheet.id },
        data: { status: 'DRAFT' },
      });
  }
  addLine(sheetValue: string, value: unknown, actor: string) {
    const sheetId = parseWarehouseId(sheetValue);
    const data = parseSheetLine(value, true);
    return this.transactions.run(actor, async (tx) => {
      const sheet = await lockIssueSheet(tx, sheetId);
      assertSheetOpen(sheet.status);
      await lockWarehouse(tx, sheet.warehouseId, true);
      await this.validateReferences(tx, data, sheet.warehouseId);
      const duplicate = await tx.warehouseIssueSheetLine.findUnique({
        where: {
          issueSheetId_rowNumber: {
            issueSheetId: sheetId,
            rowNumber: data.rowNumber!,
          },
        },
      });
      if (duplicate)
        sheetConflict(
          'WAREHOUSE_ISSUE_SHEET_ROW_EXISTS',
          'Этот номер строки уже занят.',
        );
      const line = await tx.warehouseIssueSheetLine.create({
        data: {
          ...data,
          issueSheetId: sheetId,
          quantity: data.quantity!,
          rowNumber: data.rowNumber!,
          matchingStatus: data.matchingStatus!,
        },
      });
      await this.invalidateReady(tx, sheet);
      await this.transactions.writeAudit(
        tx,
        actor,
        sheetId,
        { status: sheet.status },
        {
          line: lineDto(line),
          status: sheet.status === 'READY' ? 'DRAFT' : sheet.status,
        },
      );
      return lineDto(line);
    });
  }
  private async mutableLine(
    tx: Prisma.TransactionClient,
    sheetId: bigint,
    lineId: bigint,
  ) {
    const sheet = await lockIssueSheet(tx, sheetId);
    assertSheetOpen(sheet.status);
    const line = await tx.warehouseIssueSheetLine.findFirst({
      where: { id: lineId, issueSheetId: sheetId },
    });
    if (!line) sheetNotFound(true);
    if (await tx.warehouseIssue.count({ where: { issueSheetLineId: lineId } }))
      sheetConflict(
        'WAREHOUSE_ISSUE_SHEET_LINE_STARTED',
        'По строке уже началась выдача. Изменение и удаление запрещены.',
      );
    return { sheet, line };
  }
  updateLine(
    sheetValue: string,
    lineValue: string,
    value: unknown,
    actor: string,
  ) {
    const sheetId = parseWarehouseId(sheetValue),
      lineId = parseWarehouseId(lineValue);
    const patch = parseSheetLine(value, false);
    return this.transactions.run(actor, async (tx) => {
      const { sheet, line } = await this.mutableLine(tx, sheetId, lineId);
      const next = { ...line, ...patch };
      // A different item takes its own unit unless an explicit snapshot was provided.
      if (
        patch.itemId !== undefined &&
        patch.itemId !== line.itemId &&
        patch.unitSnapshot === undefined
      )
        next.unitSnapshot = null;
      await lockWarehouse(tx, sheet.warehouseId, true);
      await this.validateReferences(tx, next, sheet.warehouseId);
      const updated = await tx.warehouseIssueSheetLine.update({
        where: { id: lineId },
        data: { ...patch, unitSnapshot: next.unitSnapshot },
      });
      await this.invalidateReady(tx, sheet);
      await this.transactions.writeAudit(
        tx,
        actor,
        sheetId,
        { line: lineDto(line), status: sheet.status },
        {
          line: lineDto(updated),
          status: sheet.status === 'READY' ? 'DRAFT' : sheet.status,
        },
      );
      return lineDto(updated);
    });
  }
  removeLine(sheetValue: string, lineValue: string, actor: string) {
    const sheetId = parseWarehouseId(sheetValue),
      lineId = parseWarehouseId(lineValue);
    return this.transactions.run(actor, async (tx) => {
      const { sheet, line } = await this.mutableLine(tx, sheetId, lineId);
      await tx.warehouseIssueSheetLine.delete({ where: { id: lineId } });
      await this.invalidateReady(tx, sheet);
      await this.transactions.writeAudit(
        tx,
        actor,
        sheetId,
        { line: lineDto(line), status: sheet.status },
        {
          line: null,
          status: sheet.status === 'READY' ? 'DRAFT' : sheet.status,
        },
      );
      return { removed: true };
    });
  }
}
