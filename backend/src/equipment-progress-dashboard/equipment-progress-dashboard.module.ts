import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { EquipmentProgressDashboardController } from './equipment-progress-dashboard.controller';
import { EquipmentProgressDashboardService } from './equipment-progress-dashboard.service';

@Module({
  controllers: [EquipmentProgressDashboardController],
  imports: [PrismaModule],
  providers: [EquipmentProgressDashboardService],
})
export class EquipmentProgressDashboardModule {}
