import {
  captureIssueHeader,
  captureIssuePosition,
  issueHistorySearch,
} from './issues-history';
import { Injectable } from '@nestjs/common';
import { AuditAction, AuditModule, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../../audit/audit-log.service';
import { WarehouseStockService } from '../stock/stock.service';
import { WarehouseIssueSheetsService } from '../issue-sheets/issue-sheets.service';
import {
  parseIssue,
  issueRequestHash,
  type IssueInput,
} from './issues.validation';
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
  ) {}
  createIssue(value: unknown, actor: string) {
    return this.run(parseIssue(value), actor);
  }
  createManualIssue(value: unknown, actor: string) {
    const input = parseIssue(value);
    if (input.type !== 'MANUAL')
      issueConflict('WAREHOUSE_ISSUE_TYPE', 'Ожидается ручная выдача.');
    return this.run(input, actor);
  }
  createIssueFromSheet(value: unknown, actor: string) {
    const input = parseIssue(value);
    if (input.type !== 'ISSUE_SHEET')
      issueConflict('WAREHOUSE_ISSUE_TYPE', 'Ожидается выдача по листу.');
    return this.run(input, actor);
  }
  private run(input: IssueInput, actor: string) {
    return this.prisma.$transaction(
      async (tx) => {
        await this.access.assertAccess(
          tx,
          actor,
          input.issueSheetLineId !== null,
        );
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${JSON.stringify(['warehouse:issue', actor, input.requestKey])}, 0))`;
        const previous = await tx.warehouseIssueRequest.findUnique({
          where: {
            actorUserId_requestKey: {
              actorUserId: actor,
              requestKey: input.requestKey,
            },
          },
        });
        if (previous) {
          if (previous.requestHash !== issueRequestHash(input))
            issueConflict(
              'WAREHOUSE_ISSUE_REQUEST_CONFLICT',
              'Ключ запроса уже использован для другой выдачи.',
            );
          return previous.response;
        }
        const execute = async () => {
          const plan = await this.plans.build(tx, input);
          return this.persist(tx, input, actor, plan);
        };
        if (input.issueSheetLineId !== null) {
          const { itemId, warehouseId } = await this.plans.resolveItem(
            tx,
            input,
          );
          const quantity = input.positions
            .reduce((sum, p) => sum.plus(p.quantity), new Prisma.Decimal(0))
            .toString();
          return this.sheets.executeIssueForLine(
            tx,
            String(input.issueSheetLineId),
            String(itemId),
            quantity,
            actor,
            async (line) => {
              if (warehouseId !== line.warehouseId)
                issueConflict(
                  'WAREHOUSE_ISSUE_SHEET_WAREHOUSE_MISMATCH',
                  'Склад выдачи не соответствует листу.',
                );
              return execute();
            },
          );
        }
        return execute();
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
    plan: IssuePlan,
  ) {
    const snapshot = await captureIssueHeader(
      tx,
      actor,
      input.issueSheetLineId,
      plan,
    );
    const positionSnapshots = plan.positions.map(captureIssuePosition);
    const issue = await tx.warehouseIssue.create({
      data: {
        snapshot,
        searchText: issueHistorySearch(
          snapshot,
          positionSnapshots,
          input.comment,
        ),
        warehouseId: plan.warehouseId,
        type: input.type,
        issueSheetLineId: input.issueSheetLineId,
        issuedByUserId: actor,
        comment: input.comment,
      },
    });
    for (const position of plan.positions) {
      await this.stock.issueStock(
        { tx, actorUserId: actor },
        String(plan.itemId),
        String(position.balance.storageLocationId),
        position.quantity,
      );
      await tx.warehouseIssuePosition.create({
        data: {
          snapshot: captureIssuePosition(position),
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
      fields: [{ fieldName: 'Выдача со склада', newValue: dto }],
    });
    // Persist the JSON response so retries do not depend on renamed references or audit retention.
    const response = JSON.parse(JSON.stringify(dto)) as Prisma.InputJsonObject;
    await tx.warehouseIssueRequest.create({
      data: {
        actorUserId: actor,
        requestKey: input.requestKey,
        requestHash: issueRequestHash(input),
        issueId: issue.id,
        response,
      },
    });
    return response;
  }
}
