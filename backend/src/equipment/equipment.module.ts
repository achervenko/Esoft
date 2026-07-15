import { Module } from '@nestjs/common';
import { NumberingModule } from '../application/numbering/numbering.module';
import { AuditModule } from '../audit/audit.module';
import { PrismaModule } from '../prisma/prisma.module';
import { SearchModule } from '../search/search.module';
import { StorageModule } from '../storage/storage.module';
import { EquipmentFilesController } from './equipment-files.controller';
import { EquipmentController } from './equipment.controller';
import { EquipmentService } from './equipment.service';

@Module({
  imports: [
    AuditModule,
    NumberingModule,
    PrismaModule,
    SearchModule,
    StorageModule,
  ],
  controllers: [EquipmentController, EquipmentFilesController],
  providers: [EquipmentService],
})
export class EquipmentModule {}
