import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuditModule } from '../../audit/audit.module';
import { WarehouseStockModule } from '../stock/stock.module';
import { WarehouseReservationsModule } from '../reservations/reservations.module';
import { WarehouseTransfersService } from './transfers.service';
import { WarehouseTransfersController } from './transfers.controller';
@Module({
  imports: [
    PrismaModule,
    AuditModule,
    WarehouseStockModule,
    WarehouseReservationsModule,
  ],
  controllers: [WarehouseTransfersController],
  providers: [WarehouseTransfersService],
})
export class WarehouseTransfersModule {}
