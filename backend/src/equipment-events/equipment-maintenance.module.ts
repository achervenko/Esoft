import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { MaintenanceSettingsAssertions } from './maintenance-settings/maintenance-settings.assertions';
import { MaintenanceSettingsController } from './maintenance-settings/maintenance-settings.controller';
import { MaintenanceSettingsService } from './maintenance-settings/maintenance-settings.service';
import { MaintenanceTypesController } from './maintenance-types/maintenance-types.controller';
import { MaintenanceTypesService } from './maintenance-types/maintenance-types.service';

@Module({
  imports: [PrismaModule],
  controllers: [MaintenanceSettingsController, MaintenanceTypesController],
  providers: [
    MaintenanceSettingsAssertions,
    MaintenanceSettingsService,
    MaintenanceTypesService,
  ],
})
export class EquipmentMaintenanceModule {}
