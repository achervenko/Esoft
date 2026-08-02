import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { StorageDocumentType } from '@prisma/client';
import { loadRootConfig } from './config/root-environment';
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
    StorageModule.register({
      documentRules: {
        [StorageDocumentType.equipment_photo]: {
          allowedExtensions: ['jpg', 'jpeg', 'png', 'webp'],
          allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
          maxPixelCount: 120_000_000,
          validateContent: 'image',
        },
        [StorageDocumentType.maintenance_instruction]: {
          allowedExtensions: ['pdf'],
          allowedMimeTypes: ['application/pdf'],
          validateContent: 'pdf',
        },
        [StorageDocumentType.passport]: {
          allowedExtensions: ['pdf'],
          allowedMimeTypes: ['application/pdf'],
          validateContent: 'pdf',
        },
      },
      primaryDocumentTypes: [StorageDocumentType.equipment_photo],
      singleDocumentTypes: [StorageDocumentType.passport],
    }),
    AppAuthModule,
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
  ],
})
export class AppModule {}
