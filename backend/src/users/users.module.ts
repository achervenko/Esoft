import { StorageModule } from '../storage/storage.module';
import { Module } from '@nestjs/common';
import { ActiveModulesModule } from '../config/active-modules.module';
import { PrismaModule } from '../prisma/prisma.module';
import { UserPhotoService } from './user-photo.service';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [StorageModule, PrismaModule, ActiveModulesModule],
  controllers: [UsersController],
  providers: [UserPhotoService, UsersService],
})
export class UsersModule {}
