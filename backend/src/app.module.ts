import { IntegrationRuntimeModule } from './integrations/integration-runtime.module';
import { Module } from '@nestjs/common';
import { loadRootEnvironment } from './config/root-environment';
import { loadActiveModules } from './config/active-modules.module';
import { loadOptionalModules } from './config/optional-modules';
import { AppAuthModule } from './auth/auth.module';
import { CalendarModule } from './calendar/calendar.module';
import { ChecklistsModule } from './checklists/checklists.module';
import { DictionariesAdminModule } from './dictionaries-admin/dictionaries-admin.module';
import { EventsModule } from './events/events.module';
import { HealthModule } from './health/health.module';
import { SearchModule } from './search/search.module';
import { SetupModule } from './setup/setup.module';
import { UsersAdminModule } from './users-admin/users-admin.module';
import { UsersModule } from './users/users.module';

const { projectRoot } = loadRootEnvironment();
const optionalModules = loadOptionalModules(loadActiveModules(projectRoot));

@Module({
  imports: [
    AppAuthModule,
    IntegrationRuntimeModule,

    CalendarModule,
    ChecklistsModule,
    DictionariesAdminModule,
    EventsModule,
    HealthModule,
    SearchModule,
    SetupModule,
    UsersAdminModule,
    UsersModule,
    ...optionalModules,
  ],
})
export class AppModule {}
