import { IntegrationRuntimeModule } from './integrations/integration-runtime.module';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { loadRootEnvironment } from './config/root-environment';
import { loadOptionalWarehouseModule } from './config/optional-warehouse-module';
import { AppAuthModule } from './auth/auth.module';
import { CalendarModule } from './calendar/calendar.module';
import { ChecklistsModule } from './checklists/checklists.module';
import { DictionariesAdminModule } from './dictionaries-admin/dictionaries-admin.module';
import { EquipmentMaintenanceModule } from './equipment-events/equipment-maintenance.module';
import { EquipmentProgressDashboardModule } from './equipment-progress-dashboard/equipment-progress-dashboard.module';
import { EquipmentModule } from './equipment/equipment.module';
import { EventsModule } from './events/events.module';
import { HealthModule } from './health/health.module';
import { SearchModule } from './search/search.module';
import { SetupModule } from './setup/setup.module';
import { UsersAdminModule } from './users-admin/users-admin.module';
import { UsersModule } from './users/users.module';
import { PpeModule } from './ppe/ppe.module';

const { projectRoot } = loadRootEnvironment();
const optionalWarehouseModules = loadOptionalWarehouseModule(projectRoot);

@Module({
  imports: [
    ConfigModule.forRoot({
      ignoreEnvFile: true,
      isGlobal: true,
    }),
    AppAuthModule,
    IntegrationRuntimeModule,

    CalendarModule,
    ChecklistsModule,
    DictionariesAdminModule,
    EquipmentMaintenanceModule,
    EquipmentProgressDashboardModule,
    EquipmentModule,
    EventsModule,
    HealthModule,
    SearchModule,
    SetupModule,
    UsersAdminModule,
    UsersModule,
    PpeModule,
    ...optionalWarehouseModules,
  ],
})
export class AppModule {}
