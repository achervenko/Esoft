import { lockWarehouse } from '../storage-structure/storage-structure.policy';
import { Injectable } from '@nestjs/common';
import { AuditAction } from '@prisma/client';
import { parseWarehouseId } from '../catalog/catalog.validation';
import { assertSheetOpen, sheetConflict, sheetDto } from './issue-sheets.model';
import { getLineProgress } from './issue-sheets-query.service';
import {
  lockIssueSheet,
  WarehouseIssueSheetTransactions,
} from './issue-sheets-transaction.service';
import { WarehouseIssueSheetLinesService } from './issue-sheets-lines.service';
import { parseCreateSheet } from './issue-sheets.validation';

@Injectable()
export class WarehouseIssueSheetLifecycleService {
  constructor(
    private readonly transactions: WarehouseIssueSheetTransactions,
    private readonly lines: WarehouseIssueSheetLinesService,
  ) {}
  create(value: unknown, actor: string) {
    const data = parseCreateSheet(value);
    return this.transactions.run(actor, async (tx) => {
      await lockWarehouse(tx, data.warehouseId, true);
      const sheet = await tx.warehouseIssueSheet.create({
        data: { ...data, status: 'DRAFT', createdByUserId: actor },
      });
      const dto = sheetDto(sheet);
      await this.transactions.writeAudit(
        tx,
        actor,
        sheet.id,
        null,
        dto,
        AuditAction.CREATE,
      );
      return dto;
    });
  }
  markReady(value: string, actor: string) {
    const id = parseWarehouseId(value);
    return this.transactions.run(actor, async (tx) => {
      const sheet = await lockIssueSheet(tx, id);
      assertSheetOpen(sheet.status);
      if (!['DRAFT', 'READY'].includes(sheet.status))
        sheetConflict('WAREHOUSE_ISSUE_SHEET_STATE', 'Лист уже исполняется.');
      await lockWarehouse(tx, sheet.warehouseId, true);
      const lines = await tx.warehouseIssueSheetLine.findMany({
        where: { issueSheetId: id },
        orderBy: { itemId: 'asc' },
      });
      if (!lines.length)
        sheetConflict(
          'WAREHOUSE_ISSUE_SHEET_NOT_READY',
          'Добавьте хотя бы одну строку.',
        );
      for (const line of lines) {
        if (
          !line.itemId ||
          line.quantity.lte(0) ||
          line.matchingStatus !== 'MATCHED' ||
          line.error?.trim()
        )
          sheetConflict(
            'WAREHOUSE_ISSUE_SHEET_NOT_READY',
            'Исправьте ошибки и сопоставьте все строки листа.',
          );
        await this.lines.validateReferences(tx, { ...line }, sheet.warehouseId);
      }
      if (sheet.status === 'READY') return sheetDto(sheet);
      const updated = await tx.warehouseIssueSheet.update({
        where: { id },
        data: { status: 'READY' },
      });
      await this.transactions.writeAudit(
        tx,
        actor,
        id,
        sheetDto(sheet),
        sheetDto(updated),
      );
      return sheetDto(updated);
    });
  }
  finalize(value: string, actor: string) {
    const id = parseWarehouseId(value);
    return this.transactions.run(actor, async (tx) => {
      const sheet = await lockIssueSheet(tx, id);
      if (['PROCESSED', 'PROCESSED_WITH_SHORTAGE'].includes(sheet.status))
        return sheetDto(sheet);
      if (!['READY', 'IN_PROGRESS'].includes(sheet.status))
        sheetConflict(
          'WAREHOUSE_ISSUE_SHEET_STATE',
          'Завершить можно только подготовленный или исполняемый лист.',
        );
      const lines = await getLineProgress(tx, id);
      if (!lines.length)
        sheetConflict(
          'WAREHOUSE_ISSUE_SHEET_NOT_READY',
          'Нельзя завершить пустой лист.',
        );
      if (lines.some((l) => l.issued.gt(l.quantity)))
        sheetConflict(
          'WAREHOUSE_ISSUE_SHEET_OVERISSUED',
          'Фактическая выдача превышает задание.',
        );
      const status = lines.some((l) => l.issued.lt(l.quantity))
        ? 'PROCESSED_WITH_SHORTAGE'
        : 'PROCESSED';
      const updated = await tx.warehouseIssueSheet.update({
        where: { id },
        data: { status, processedAt: new Date(), processedByUserId: actor },
      });
      await this.transactions.writeAudit(
        tx,
        actor,
        id,
        sheetDto(sheet),
        sheetDto(updated),
      );
      return sheetDto(updated);
    });
  }
  cancel(value: string, actor: string) {
    const id = parseWarehouseId(value);
    return this.transactions.run(actor, async (tx) => {
      const sheet = await lockIssueSheet(tx, id);
      if (sheet.status === 'CANCELLED') return sheetDto(sheet);
      if (
        !['DRAFT', 'READY'].includes(sheet.status) ||
        (await tx.warehouseIssue.count({
          where: { issueSheetLine: { issueSheetId: id } },
        }))
      )
        sheetConflict(
          'WAREHOUSE_ISSUE_SHEET_CANNOT_CANCEL',
          'Лист с начавшейся выдачей или закрытый лист нельзя отменить.',
        );
      const updated = await tx.warehouseIssueSheet.update({
        where: { id },
        data: { status: 'CANCELLED' },
      });
      await this.transactions.writeAudit(
        tx,
        actor,
        id,
        sheetDto(sheet),
        sheetDto(updated),
      );
      return sheetDto(updated);
    });
  }
}
