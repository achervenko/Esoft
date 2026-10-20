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
    WarehouseCatalogController,
    WarehouseStockAdjustmentsController,
  ],
  providers: [
    WarehouseCatalogService,
    WarehouseStockQueryService,
    WarehouseStockService,
    WarehouseStockAdjustmentsService,
    WarehouseStockAdjustmentAccessService,
    WarehouseStockAdjustmentCommandService,
    WarehouseStockAdjustmentDocumentService,
    WarehouseStockAdjustmentQueryService,
  ],
  exports: [WarehouseStockService],
})
export class WarehouseModule {}
