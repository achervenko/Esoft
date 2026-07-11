import { Module } from '@nestjs/common';
import { NumberingModule } from '../application/numbering/numbering.module';
import { AuditModule } from '../audit/audit.module';
import { PrismaService } from '../prisma/prisma.service';
import { StorageModule } from '../storage/storage.module';
import { EquipmentFilesController } from './equipment-files.controller';
import { EquipmentController } from './equipment.controller';
import { EquipmentService } from './equipment.service';

@Module({
  imports: [AuditModule, NumberingModule, StorageModule],
  controllers: [EquipmentController, EquipmentFilesController],
  providers: [EquipmentService, PrismaService],
})
export class EquipmentModule {}
