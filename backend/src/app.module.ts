import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { loadRootConfig } from './config/root-environment';
import { AppAuthModule } from './auth/auth.module';
import { ChecklistsModule } from './checklists/checklists.module';
import { DictionariesAdminModule } from './dictionaries-admin/dictionaries-admin.module';
import { EquipmentEventsModule } from './equipment-events/equipment-events.module';
import { EquipmentModule } from './equipment/equipment.module';
import { HealthModule } from './health/health.module';
import { SearchModule } from './search/search.module';
import { SetupModule } from './setup/setup.module';
import { StorageModule } from './storage/storage.module';
import { UsersAdminModule } from './users-admin/users-admin.module';
import { UsersModule } from './users/users.module';

loadRootConfig();

@Module({
  imports: [
    ConfigModule.forRoot({
      ignoreEnvFile: true,
      isGlobal: true,
    }),
    AppAuthModule,
    ChecklistsModule,
    DictionariesAdminModule,
    EquipmentEventsModule,
    EquipmentModule,
    HealthModule,
    SearchModule,
    SetupModule,
    StorageModule,
    UsersAdminModule,
    UsersModule,
  ],
})
export class AppModule {}
