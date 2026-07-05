import { Module } from '@nestjs/common';
import { NumberingModule } from '../application/numbering/numbering.module';
import { PrismaService } from '../prisma/prisma.service';
import { EquipmentController } from './equipment.controller';
import { EquipmentService } from './equipment.service';

@Module({
  imports: [NumberingModule],
  controllers: [EquipmentController],
  providers: [EquipmentService, PrismaService],
})
export class EquipmentModule {}
