import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AppAuthModule } from './auth/auth.module';
import { DictionariesAdminModule } from './dictionaries-admin/dictionaries-admin.module';
import { EquipmentModule } from './equipment/equipment.module';
import { PrismaService } from './prisma/prisma.service';
import { StorageModule } from './storage/storage.module';
import { UsersAdminModule } from './users-admin/users-admin.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    AppAuthModule,
    DictionariesAdminModule,
    EquipmentModule,
    StorageModule,
    UsersAdminModule,
    UsersModule,
  ],
  controllers: [AppController],
  providers: [AppService, PrismaService],
})
export class AppModule {}
