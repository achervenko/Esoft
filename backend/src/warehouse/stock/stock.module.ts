import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuditModule } from '../../audit/audit.module';
import { WarehouseStockController } from './stock.controller';
import { WarehouseStockService } from './stock.service';
import { WarehouseStockQueryService } from './stock-query.service';

@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [WarehouseStockController],
  providers: [WarehouseStockService, WarehouseStockQueryService],
  exports: [WarehouseStockService],
})
export class WarehouseStockModule {}
