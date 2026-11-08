import { ReceiptIntegrationWarehousesService } from './receipt-source-warehouses.service';
import { ReceiptCatalogUsagePolicy } from './receipt-catalog-usage.policy';
import { WarehouseCatalogModule } from '../catalog/catalog.module';
import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuditModule } from '../../audit/audit.module';
import { WarehouseStockModule } from '../stock/stock.module';
import { WarehouseReceiptsController } from './receipts.controller';
import { WarehouseReceiptsService } from './receipts.service';
import { WarehouseReceiptsQueryService } from './receipts-query.service';
import { WarehouseReceiptPlacementsService } from './receipt-placements.service';
import { WarehouseReceiptItemMappingService } from './receipt-item-mapping.service';
import { WarehouseReceiptReconciliationService } from './receipt-reconciliation.service';
import { WarehouseReceiptConflictResolutionService } from './receipt-conflict-resolution.service';
import { WarehouseReceiptImportService } from './receipt-import.service';
@Module({
  imports: [
    PrismaModule,
    AuditModule,
    WarehouseStockModule,
    WarehouseCatalogModule,
  ],
  controllers: [WarehouseReceiptsController],
  providers: [
    ReceiptIntegrationWarehousesService,
    ReceiptCatalogUsagePolicy,
    WarehouseReceiptsService,
    WarehouseReceiptsQueryService,
    WarehouseReceiptPlacementsService,
    WarehouseReceiptItemMappingService,

    WarehouseReceiptReconciliationService,
    WarehouseReceiptConflictResolutionService,
    WarehouseReceiptImportService,
  ],
  exports: [
    WarehouseReceiptsService,
    WarehouseReceiptImportService,
    ReceiptIntegrationWarehousesService,
  ],
})
export class WarehouseReceiptsModule {}
