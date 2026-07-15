import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { EquipmentEventsAssertions } from './equipment-events.assertions';
import { EquipmentEventsController } from './equipment-events.controller';
import { EquipmentEventsCreator } from './equipment-events.creator';
import { EquipmentEventsService } from './equipment-events.service';
import { MaintenanceSettingsAssertions } from './maintenance-settings/maintenance-settings.assertions';
import { MaintenanceSettingsController } from './maintenance-settings/maintenance-settings.controller';
import { MaintenanceSettingsService } from './maintenance-settings/maintenance-settings.service';
import { MaintenanceTypesController } from './maintenance-types/maintenance-types.controller';
import { MaintenanceTypesService } from './maintenance-types/maintenance-types.service';

@Module({
  imports: [PrismaModule],
  controllers: [
    EquipmentEventsController,
    MaintenanceSettingsController,
    MaintenanceTypesController,
  ],
  providers: [
    EquipmentEventsAssertions,
    EquipmentEventsCreator,
    EquipmentEventsService,
    MaintenanceSettingsAssertions,
    MaintenanceSettingsService,
    MaintenanceTypesService,
  ],
  exports: [EquipmentEventsService],
})
export class EquipmentEventsModule {}
