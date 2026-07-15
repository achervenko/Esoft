import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { EquipmentEventsAssertions } from './equipment-events.assertions';
import { EquipmentEventsController } from './equipment-events.controller';
import { EquipmentEventsCreator } from './equipment-events.creator';
import { EquipmentEventsService } from './equipment-events.service';

@Module({
  imports: [PrismaModule],
  controllers: [EquipmentEventsController],
  providers: [
    EquipmentEventsAssertions,
    EquipmentEventsCreator,
    EquipmentEventsService,
  ],
  exports: [EquipmentEventsService],
})
export class EquipmentEventsModule {}
