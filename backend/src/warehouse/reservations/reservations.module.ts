import { Module } from '@nestjs/common';
import { AuditModule } from '../../audit/audit.module';
import { PrismaModule } from '../../prisma/prisma.module';
import { WarehouseStockModule } from '../stock/stock.module';
import { WarehouseReservationManager } from './reservation-manager.service';
import { WarehouseReservationQueryService } from './reservations-query.service';
import { WarehouseReservationsController } from './reservations.controller';
import { WarehouseReservationsService } from './reservations.service';
import { WarehouseReservationMoveService } from './reservation-move.service';
import { WarehouseTransfersModule } from '../transfers/transfers.module';

@Module({
  imports: [
    PrismaModule,
    AuditModule,
    WarehouseStockModule,
    WarehouseTransfersModule,
  ],
  controllers: [WarehouseReservationsController],
  providers: [
    WarehouseReservationManager,
    WarehouseReservationQueryService,
    WarehouseReservationsService,
    WarehouseReservationMoveService,
  ],
  exports: [WarehouseReservationManager],
})
export class WarehouseReservationsModule {}
