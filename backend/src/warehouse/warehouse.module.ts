import { WarehouseIssueSheetLinesService } from './issue-sheets/issue-sheets-lines.service';
import { WarehouseIssueSheetLifecycleService } from './issue-sheets/issue-sheets-lifecycle.service';
import { WarehouseIssueSheetExecutionService } from './issue-sheets/issue-sheets-execution.service';
import { WarehouseIssueSheetsController } from './issue-sheets/issue-sheets.controller';
import { WarehouseIssueSheetsService } from './issue-sheets/issue-sheets.service';
import { WarehouseIssueSheetsQueryService } from './issue-sheets/issue-sheets-query.service';
import { WarehouseIssueSheetTransactions } from './issue-sheets/issue-sheets-transaction.service';
import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { PrismaModule } from '../prisma/prisma.module';
import { WarehouseCatalogController } from './catalog/catalog.controller';
import { WarehouseCatalogService } from './catalog/catalog.service';
import { WarehouseStockQueryService } from './stock/stock-query.service';
import { WarehouseStockService } from './stock/stock.service';
import { WarehouseStockAdjustmentsController } from './adjustments/adjustments.controller';
import { WarehouseStockAdjustmentsService } from './adjustments/adjustments.service';
import { WarehouseStockAdjustmentAccessService } from './adjustments/adjustment-access.service';
import { WarehouseStockAdjustmentCommandService } from './adjustments/adjustment-command.service';
import { WarehouseStockAdjustmentDocumentService } from './adjustments/adjustment-document.service';
import { WarehouseStockAdjustmentQueryService } from './adjustments/adjustment-query.service';

@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [
    WarehouseIssueSheetsController,
    WarehouseCatalogController,
    WarehouseStockAdjustmentsController,
  ],
  providers: [
    WarehouseIssueSheetLinesService,
    WarehouseIssueSheetLifecycleService,
    WarehouseIssueSheetExecutionService,

    WarehouseIssueSheetsService,
    WarehouseIssueSheetsQueryService,
    WarehouseIssueSheetTransactions,
    WarehouseCatalogService,
    WarehouseStockQueryService,
    WarehouseStockService,
    WarehouseStockAdjustmentsService,
    WarehouseStockAdjustmentAccessService,
    WarehouseStockAdjustmentCommandService,
    WarehouseStockAdjustmentDocumentService,
    WarehouseStockAdjustmentQueryService,
  ],
  exports: [WarehouseStockService, WarehouseIssueSheetsService],
})
export class WarehouseModule {}
