import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { EquipmentEventsAssertions } from './equipment-events.assertions';
import { EquipmentEventsController } from './equipment-events.controller';
import { EquipmentEventsCreator } from './equipment-events.creator';
import { EquipmentEventsLifecycleService } from './equipment-events-lifecycle.service';
import { EquipmentEventsQueryService } from './equipment-events-query.service';
import { EquipmentEventsService } from './equipment-events.service';
import { EquipmentEventsUpdateService } from './equipment-events-update.service';
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
    EquipmentEventsLifecycleService,
    EquipmentEventsQueryService,
    EquipmentEventsService,
    EquipmentEventsUpdateService,
    MaintenanceSettingsAssertions,
    MaintenanceSettingsService,
    MaintenanceTypesService,
  ],
  exports: [EquipmentEventsService],
})
export class EquipmentEventsModule {}
