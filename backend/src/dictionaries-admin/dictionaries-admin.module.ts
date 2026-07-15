import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { DictionariesAdminController } from './dictionaries-admin.controller';
import { DictionariesAdminService } from './dictionaries-admin.service';

@Module({
  imports: [PrismaModule],
  controllers: [DictionariesAdminController],
  providers: [DictionariesAdminService],
})
export class DictionariesAdminModule {}
