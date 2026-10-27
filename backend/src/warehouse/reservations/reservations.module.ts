import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuditModule } from '../../audit/audit.module';
import { WarehouseStockModule } from '../stock/stock.module';
import { WarehouseReservationsController } from './reservations.controller';
import { WarehouseReservationsApiService } from './reservations-api.service';
import { WarehouseReservationsService } from './reservations.service';

@Module({
  imports: [PrismaModule, AuditModule, WarehouseStockModule],
  controllers: [WarehouseReservationsController],
  providers: [WarehouseReservationsApiService, WarehouseReservationsService],
  exports: [WarehouseReservationsService],
})
export class WarehouseReservationsModule {}
