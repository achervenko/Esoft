import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuditModule } from '../../audit/audit.module';
import { WarehouseStockModule } from '../stock/stock.module';
import { WarehouseReceiptsController } from './receipts.controller';
import { WarehouseReceiptsService } from './receipts.service';
import { WarehouseReceiptsQueryService } from './receipts-query.service';

@Module({
  imports: [PrismaModule, AuditModule, WarehouseStockModule],
  controllers: [WarehouseReceiptsController],
  providers: [WarehouseReceiptsService, WarehouseReceiptsQueryService],
  exports: [WarehouseReceiptsService],
})
export class WarehouseReceiptsModule {}
