import { ForbiddenException, Injectable } from '@nestjs/common';
import { AuditAction, AuditModule, Prisma } from '@prisma/client';
import { AuditLogService } from '../../audit/audit-log.service';
import { PrismaService } from '../../prisma/prisma.service';
import { hasPermission } from '../../auth/permission-policy';
import { assertStockTransaction } from '../stock/stock-locks';
import { findSheet } from './issue-sheets-query.service';
import { sheetNotFound } from './issue-sheets.model';

export async function lockIssueSheet(tx: Prisma.TransactionClient, id: bigint) {
  assertStockTransaction(tx);
  const found = await tx.$queryRaw<
    { id: bigint }[]
  >`SELECT id FROM warehouse_issue_sheets WHERE id = ${id} FOR UPDATE`;
  if (!found.length) sheetNotFound();
  return findSheet(tx, id);
}

@Injectable()
export class WarehouseIssueSheetTransactions {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
  ) {}
  async assertAccess(tx: Prisma.TransactionClient, userId: string) {
    if (typeof userId !== 'string' || !userId)
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Нет доступа к листам выдачи.',
      });
    const users = await tx.$queryRaw<
      { role: string | null; banned: boolean | null }[]
    >`SELECT role, banned FROM "user" WHERE id = ${userId} FOR SHARE`;
    if (
      !users[0] ||
      users[0].banned ||
      !hasPermission(users[0].role, 'warehouse.issue-sheets.manage')
    )
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Нет доступа к листам выдачи.',
      });
  }
  run<T>(actor: string, execute: (tx: Prisma.TransactionClient) => Promise<T>) {
    return this.prisma.$transaction(
      async (tx) => {
        await this.assertAccess(tx, actor);
        return execute(tx);
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
        timeout: 15000,
      },
    );
  }
  writeAudit(
    tx: Prisma.TransactionClient,
    actor: string,
    sheetId: bigint,
    before: unknown,
    after: unknown,
    action: AuditAction = AuditAction.UPDATE,
  ) {
    return this.audit.writeFieldChanges({
      tx,
      userId: actor,
      module: AuditModule.WAREHOUSE,
      action,
      entityType: 'warehouse_issue_sheet',
      entityStringId: sheetId.toString(),
      fields: [{ fieldName: 'Лист выдачи', oldValue: before, newValue: after }],
    });
  }
}
