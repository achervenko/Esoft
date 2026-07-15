import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AppAuthModule } from './auth/auth.module';
import { DictionariesAdminModule } from './dictionaries-admin/dictionaries-admin.module';
import { EquipmentEventsModule } from './equipment-events/equipment-events.module';
import { EquipmentModule } from './equipment/equipment.module';
import { SearchModule } from './search/search.module';
import { StorageModule } from './storage/storage.module';
import { UsersAdminModule } from './users-admin/users-admin.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    AppAuthModule,
    DictionariesAdminModule,
    EquipmentEventsModule,
    EquipmentModule,
    SearchModule,
    StorageModule,
    UsersAdminModule,
    UsersModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
