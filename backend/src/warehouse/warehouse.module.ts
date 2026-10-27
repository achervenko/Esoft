import { WarehouseTransfersModule } from './transfers/transfers.module';
import { Module } from '@nestjs/common';
import { WarehouseStorageStructureModule } from './storage-structure/storage-structure.module';
import { WarehouseProjectsModule } from './projects/projects.module';
import { WarehouseStockModule } from './stock/stock.module';
import { WarehouseCatalogModule } from './catalog/catalog.module';
import { WarehouseReservationsModule } from './reservations/reservations.module';
import { WarehouseIssueSheetsModule } from './issue-sheets/issue-sheets.module';
import { WarehouseIssuesModule } from './issues/issues.module';
import { WarehouseReceiptsModule } from './receipts/receipts.module';
import { WarehouseStockAdjustmentsModule } from './adjustments/adjustments.module';

@Module({
  imports: [
    WarehouseStorageStructureModule,
    WarehouseProjectsModule,
    WarehouseStockModule,
    WarehouseCatalogModule,
    WarehouseReservationsModule,
    WarehouseIssueSheetsModule,
    WarehouseIssuesModule,
    WarehouseReceiptsModule,
    WarehouseStockAdjustmentsModule,
    WarehouseTransfersModule,
  ],
  // Preserve the existing Stock, IssueSheets and Receipts injection API for importing modules.
  exports: [
    WarehouseStockModule,
    WarehouseIssueSheetsModule,
    WarehouseReceiptsModule,
  ],
})
export class WarehouseModule {}
