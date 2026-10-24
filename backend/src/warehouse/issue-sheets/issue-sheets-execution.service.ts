import { Injectable } from '@nestjs/common';
import { Prisma, type WarehouseIssueSheetLine } from '@prisma/client';
import { parseWarehouseId } from '../catalog/catalog.validation';
import { stockQuantity } from '../stock/stock.validation';
import { assertStockTransaction } from '../stock/stock-locks';
import { sheetConflict, sheetDto, sheetNotFound } from './issue-sheets.model';
import {
  lockIssueSheet,
  WarehouseIssueSheetTransactions,
} from './issue-sheets-transaction.service';

@Injectable()
export class WarehouseIssueSheetExecutionService {
  constructor(private readonly transactions: WarehouseIssueSheetTransactions) {}
  /** Issues must execute its entire write/stock operation in this callback and transaction.
   * Lock order: sheet -> item/location -> balances; never acquire the sheet after stock locks.
   */
  async executeIssueForLine<T>(
    tx: Prisma.TransactionClient,
    lineValue: string,
    itemValue: string,
    quantityValue: string,
    actor: string,
    execute: (line: WarehouseIssueSheetLine) => Promise<T>,
  ): Promise<T> {
    const lineId = parseWarehouseId(lineValue),
      itemId = parseWarehouseId(itemValue);
    const quantity = stockQuantity(quantityValue);
    assertStockTransaction(tx);
    const [transaction] = await tx.$queryRaw<{ isolation: string }[]>`
      SELECT current_setting('transaction_isolation') AS isolation
    `;
    if (transaction?.isolation !== 'read committed')
      sheetConflict(
        'WAREHOUSE_ISSUE_SHEET_ISOLATION_REQUIRED',
        'Выдача по листу требует транзакцию ReadCommitted.',
      );
    await this.transactions.assertAccess(tx, actor);
    const initial = await tx.warehouseIssueSheetLine.findUnique({
      where: { id: lineId },
      select: { issueSheetId: true },
    });
    if (!initial) sheetNotFound(true);
    const sheet = await lockIssueSheet(tx, initial.issueSheetId);
    if (!['READY', 'IN_PROGRESS'].includes(sheet.status))
      sheetConflict(
        'WAREHOUSE_ISSUE_SHEET_STATE',
        'Лист не открыт для выдачи.',
      );
    const line = await tx.warehouseIssueSheetLine.findUnique({
      where: { id: lineId },
    });
    if (!line) sheetNotFound(true);
    if (
      line.itemId !== itemId ||
      line.matchingStatus !== 'MATCHED' ||
      line.error?.trim()
    )
      sheetConflict(
        'WAREHOUSE_ISSUE_SHEET_ITEM_MISMATCH',
        'Выдача не соответствует строке задания.',
      );
    const total = async () =>
      (
        await tx.warehouseIssuePosition.aggregate({
          where: { issue: { issueSheetLineId: lineId } },
          _sum: { quantity: true },
        })
      )._sum.quantity ?? new Prisma.Decimal(0);
    const before = await total();
    if (before.plus(quantity).gt(line.quantity))
      sheetConflict(
        'WAREHOUSE_ISSUE_SHEET_OVERISSUED',
        'Количество превышает остаток задания.',
      );
    const result = await execute(line);
    const after = await total();
    const mismatched = await tx.warehouseIssue.count({
      where: {
        issueSheetLineId: lineId,
        OR: [
          ...(line.projectId
            ? [{ projectId: { not: line.projectId } }, { projectId: null }]
            : [{ projectId: { not: null } }]),
          { positions: { some: { balance: { itemId: { not: itemId } } } } },
          { type: { not: 'ISSUE_SHEET' } },
        ],
      },
    });
    if (!after.equals(before.plus(quantity)) || mismatched)
      sheetConflict(
        'WAREHOUSE_ISSUE_SHEET_ISSUE_MISMATCH',
        'Операция выдачи не соответствует заданию.',
      );
    if (sheet.status === 'READY') {
      const updated = await tx.warehouseIssueSheet.update({
        where: { id: sheet.id },
        data: { status: 'IN_PROGRESS' },
      });
      await this.transactions.writeAudit(
        tx,
        actor,
        sheet.id,
        sheetDto(sheet),
        sheetDto(updated),
      );
    }
    return result;
  }
}
