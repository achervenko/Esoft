import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DictionariesAdminController } from './dictionaries-admin.controller';
import { DictionariesAdminService } from './dictionaries-admin.service';

@Module({
  controllers: [DictionariesAdminController],
  providers: [DictionariesAdminService, PrismaService],
})
export class DictionariesAdminModule {}
