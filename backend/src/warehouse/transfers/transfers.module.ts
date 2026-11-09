import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuditModule } from '../../audit/audit.module';
import { WarehouseStockModule } from '../stock/stock.module';
import { WarehouseTransfersService } from './transfers.service';
import { WarehouseTransfersController } from './transfers.controller';
import { WarehouseTransferConsolidationService } from './transfers-consolidation.service';
@Module({
  imports: [PrismaModule, AuditModule, WarehouseStockModule],
  controllers: [WarehouseTransfersController],
  providers: [WarehouseTransfersService, WarehouseTransferConsolidationService],
  exports: [WarehouseTransfersService],
})
export class WarehouseTransfersModule {}
