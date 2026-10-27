import { Injectable } from '@nestjs/common';
import type { Prisma, WarehouseIssueSheetLine } from '@prisma/client';
import { WarehouseIssueSheetLinesService } from './issue-sheets-lines.service';
import { WarehouseIssueSheetLifecycleService } from './issue-sheets-lifecycle.service';
import { WarehouseIssueSheetExecutionService } from './issue-sheets-execution.service';

@Injectable()
export class WarehouseIssueSheetsService {
  constructor(
    private readonly lines: WarehouseIssueSheetLinesService,
    private readonly lifecycle: WarehouseIssueSheetLifecycleService,
    private readonly execution: WarehouseIssueSheetExecutionService,
  ) {}
  create(value: unknown, actor: string) {
    return this.lifecycle.create(value, actor);
  }
  addLine(sheetId: string, value: unknown, actor: string) {
    return this.lines.addLine(sheetId, value, actor);
  }
  updateLine(sheetId: string, lineId: string, value: unknown, actor: string) {
    return this.lines.updateLine(sheetId, lineId, value, actor);
  }
  removeLine(sheetId: string, lineId: string, actor: string) {
    return this.lines.removeLine(sheetId, lineId, actor);
  }
  markReady(id: string, actor: string) {
    return this.lifecycle.markReady(id, actor);
  }
  finalize(id: string, actor: string) {
    return this.lifecycle.finalize(id, actor);
  }
  cancel(id: string, actor: string) {
    return this.lifecycle.cancel(id, actor);
  }
  previewIssueForLine(
    tx: Prisma.TransactionClient,
    lineId: string,
    itemId: string,
    quantity: string,
    actor: string,
  ) {
    return this.execution.previewIssueForLine(
      tx,
      lineId,
      itemId,
      quantity,
      actor,
    );
  }
  executeIssueForLine<T>(
    tx: Prisma.TransactionClient,
    lineId: string,
    itemId: string,
    quantity: string,
    actor: string,
    execute: (
      line: WarehouseIssueSheetLine & { warehouseId: bigint },
    ) => Promise<T>,
  ) {
    return this.execution.executeIssueForLine(
      tx,
      lineId,
      itemId,
      quantity,
      actor,
      execute,
    );
  }
}
