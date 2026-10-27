import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuditModule } from '../../audit/audit.module';
import { WarehouseStockModule } from '../stock/stock.module';
import { WarehouseStockAdjustmentsController } from './adjustments.controller';
import { WarehouseStockAdjustmentsService } from './adjustments.service';
import { WarehouseStockAdjustmentAccessService } from './adjustment-access.service';
import { WarehouseStockAdjustmentCommandService } from './adjustment-command.service';
import { WarehouseStockAdjustmentDocumentService } from './adjustment-document.service';
import { WarehouseStockAdjustmentQueryService } from './adjustment-query.service';

@Module({
  imports: [PrismaModule, AuditModule, WarehouseStockModule],
  controllers: [WarehouseStockAdjustmentsController],
  providers: [
    WarehouseStockAdjustmentsService,
    WarehouseStockAdjustmentAccessService,
    WarehouseStockAdjustmentCommandService,
    WarehouseStockAdjustmentDocumentService,
    WarehouseStockAdjustmentQueryService,
  ],
})
export class WarehouseStockAdjustmentsModule {}
