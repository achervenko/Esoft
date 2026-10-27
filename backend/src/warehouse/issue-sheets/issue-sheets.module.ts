import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuditModule } from '../../audit/audit.module';
import { WarehouseIssueSheetsController } from './issue-sheets.controller';
import { WarehouseIssueSheetsService } from './issue-sheets.service';
import { WarehouseIssueSheetsQueryService } from './issue-sheets-query.service';
import { WarehouseIssueSheetLinesService } from './issue-sheets-lines.service';
import { WarehouseIssueSheetLifecycleService } from './issue-sheets-lifecycle.service';
import { WarehouseIssueSheetExecutionService } from './issue-sheets-execution.service';
import { WarehouseIssueSheetTransactions } from './issue-sheets-transaction.service';

@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [WarehouseIssueSheetsController],
  providers: [
    WarehouseIssueSheetsService,
    WarehouseIssueSheetsQueryService,
    WarehouseIssueSheetLinesService,
    WarehouseIssueSheetLifecycleService,
    WarehouseIssueSheetExecutionService,
    WarehouseIssueSheetTransactions,
  ],
  exports: [WarehouseIssueSheetsService],
})
export class WarehouseIssueSheetsModule {}
