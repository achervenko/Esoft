import { Module } from '@nestjs/common';
import { ChecklistsModule } from '../checklists/checklists.module';
import { EquipmentEventExtensionModule } from '../equipment-event-extension/equipment-event-extension.module';
import { EventsModule } from '../events/events.module';
import { PrismaModule } from '../prisma/prisma.module';
import { EquipmentEventChecklistCreator } from './equipment-event-checklist.creator';
import { EquipmentEventStateAssertions } from './equipment-event-state.assertions';
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
  imports: [
    PrismaModule,
    ChecklistsModule,
    EquipmentEventExtensionModule,
    EventsModule,
  ],
  controllers: [
    EquipmentEventsController,
    MaintenanceSettingsController,
    MaintenanceTypesController,
  ],
  providers: [
    EquipmentEventChecklistCreator,
    EquipmentEventStateAssertions,
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
