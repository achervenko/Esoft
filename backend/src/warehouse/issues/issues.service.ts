import { Injectable } from '@nestjs/common';
import { AuditAction, AuditModule, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../../audit/audit-log.service';
import { WarehouseStockService } from '../stock/stock.service';
import { WarehouseIssueSheetsService } from '../issue-sheets/issue-sheets.service';
import { WarehouseReservationsService } from '../reservations/reservations.service';
import { parseIssue, type IssueInput } from './issues.validation';
import { issueConflict, issueDto, issueInclude } from './issues.model';
import { WarehouseIssuesAccessService } from './issues-access.service';
import {
  WarehouseIssuePlanService,
  type IssuePlan,
} from './issues-plan.service';

@Injectable()
export class WarehouseIssuesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
    private readonly access: WarehouseIssuesAccessService,
    private readonly plans: WarehouseIssuePlanService,
    private readonly stock: WarehouseStockService,
    private readonly sheets: WarehouseIssueSheetsService,
    private readonly reservations: WarehouseReservationsService,
  ) {}
  createIssue(value: unknown, actor: string) {
    return this.run(parseIssue(value), actor, false);
  }
  previewOverride(value: unknown, actor: string) {
    const input = parseIssue(value);
    if (!input.overrideReservations)
      issueConflict(
        'WAREHOUSE_ISSUE_OVERRIDE_REQUIRED',
        'Предварительный расчёт предназначен для принудительной выдачи.',
      );
    return this.run(input, actor, true);
  }
  createManualIssue(value: unknown, actor: string) {
    const input = parseIssue(value);
    if (input.type !== 'MANUAL')
      issueConflict('WAREHOUSE_ISSUE_TYPE', 'Ожидается ручная выдача.');
    return this.run(input, actor, false);
  }
  createIssueFromSheet(value: unknown, actor: string) {
    const input = parseIssue(value);
    if (input.type !== 'ISSUE_SHEET')
      issueConflict('WAREHOUSE_ISSUE_TYPE', 'Ожидается выдача по листу.');
    return this.run(input, actor, false);
  }
  private run(input: IssueInput, actor: string, preview: boolean) {
    return this.prisma.$transaction(
      async (tx) => {
        await this.access.assertAccess(tx, actor, input.overrideReservations);
        const execute = async (projectId: bigint | null) => {
          await this.access.assertProject(tx, projectId);
          const plan = await this.plans.build(tx, input, actor, projectId);
          if (preview)
            return {
              confirmationToken: plan.confirmationToken,
              foreignReservations: plan.foreignReservations,
              reservationChanges: plan.changes,
              totalQuantity: input.positions
                .reduce((sum, p) => sum.plus(p.quantity), new Prisma.Decimal(0))
                .toString(),
            };
          if (
            input.overrideReservations &&
            input.overrideConfirmation !== plan.confirmationToken
          )
            issueConflict(
              'WAREHOUSE_ISSUE_CONFIRMATION_REQUIRED',
              'Подтвердите актуальный предварительный расчёт принудительной выдачи.',
            );
          return this.persist(tx, input, actor, projectId, plan);
        };
        if (input.issueSheetLineId !== null) {
          const { itemId } = await this.plans.resolveItem(tx, input);
          const quantity = input.positions
            .reduce((sum, p) => sum.plus(p.quantity), new Prisma.Decimal(0))
            .toString();
          // Preview does not create an issue, so it cannot use the execution callback contract.
          if (preview) {
            const line = await this.sheets.previewIssueForLine(
              tx,
              String(input.issueSheetLineId),
              String(itemId),
              quantity,
              actor,
            );
            if (
              input.projectId !== undefined &&
              input.projectId !== line.projectId
            )
              issueConflict(
                'WAREHOUSE_ISSUE_PROJECT_MISMATCH',
                'Проект не соответствует строке листа.',
              );
            return execute(line.projectId);
          }
          return this.sheets.executeIssueForLine(
            tx,
            String(input.issueSheetLineId),
            String(itemId),
            quantity,
            actor,
            async (line) => {
              if (
                input.projectId !== undefined &&
                input.projectId !== line.projectId
              )
                issueConflict(
                  'WAREHOUSE_ISSUE_PROJECT_MISMATCH',
                  'Проект не соответствует строке листа.',
                );
              return execute(line.projectId);
            },
          );
        }
        return execute(input.projectId ?? null);
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
        timeout: 15000,
      },
    );
  }
  private async persist(
    tx: Prisma.TransactionClient,
    input: IssueInput,
    actor: string,
    projectId: bigint | null,
    plan: IssuePlan,
  ) {
    const issue = await tx.warehouseIssue.create({
      data: {
        type: input.type,
        projectId,
        issueSheetLineId: input.issueSheetLineId,
        issuedByUserId: actor,
        comment: input.comment,
        overrideReservations: input.overrideReservations,
      },
    });
    await this.reservations.consume(tx, plan.changes, actor, issue.id);
    for (const position of plan.positions) {
      await this.stock.issueStock(
        { tx, actorUserId: actor },
        String(plan.itemId),
        String(position.balance.storageLocationId),
        position.quantity,
      );
      await tx.warehouseIssuePosition.create({
        data: {
          issueId: issue.id,
          balanceId: position.balance.id,
          quantity: position.quantity,
        },
      });
    }
    const dto = issueDto(
      await tx.warehouseIssue.findUniqueOrThrow({
        where: { id: issue.id },
        include: issueInclude,
      }),
    );
    await this.audit.writeFieldChanges({
      tx,
      userId: actor,
      module: AuditModule.WAREHOUSE,
      action: AuditAction.CREATE,
      entityType: 'warehouse_issue',
      entityStringId: String(issue.id),
      fields: [
        { fieldName: 'Выдача со склада', newValue: dto },
        { fieldName: 'Использование резервов', newValue: plan.changes },
      ],
    });
    return {
      ...dto,
      reservationUsage: plan.changes,
      foreignReservationsUsed: plan.foreignReservations.length > 0,
    };
  }
}
