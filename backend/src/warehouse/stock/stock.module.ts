import { WarehouseStorageStructureModule } from '../storage-structure/storage-structure.module';
import { WarehouseStockOverviewController } from './stock-overview.controller';
import { WarehouseStockOverviewService } from './stock-overview.service';
import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuditModule } from '../../audit/audit.module';
import { WarehouseStockController } from './stock.controller';
import { WarehouseStockService } from './stock.service';
import { WarehouseStockQueryService } from './stock-query.service';

@Module({
  imports: [PrismaModule, AuditModule, WarehouseStorageStructureModule],
  controllers: [WarehouseStockController, WarehouseStockOverviewController],
  providers: [
    WarehouseStockService,
    WarehouseStockQueryService,
    WarehouseStockOverviewService,
  ],
  exports: [WarehouseStockService],
})
export class WarehouseStockModule {}
