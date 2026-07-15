import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { StorageModule } from '../storage/storage.module';
import { UserPhotoService } from './user-photo.service';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [PrismaModule, StorageModule],
  controllers: [UsersController],
  providers: [UserPhotoService, UsersService],
})
export class UsersModule {}
