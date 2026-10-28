import { Module } from '@nestjs/common';
import { AuditModule } from '../../audit/audit.module';
import { PrismaModule } from '../../prisma/prisma.module';
import { WarehouseStorageLocationsController } from './storage-locations.controller';
import { WarehouseStorageLocationsService } from './storage-locations.service';
import { WarehousesController } from './warehouses.controller';
import { WarehousesService } from './warehouses.service';

@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [WarehousesController, WarehouseStorageLocationsController],
  providers: [WarehousesService, WarehouseStorageLocationsService],
  exports: [WarehousesService, WarehouseStorageLocationsService],
})
export class WarehouseStorageStructureModule {}
